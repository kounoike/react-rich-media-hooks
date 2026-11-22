"""Local-only, pinned multi-speaker/environment corpus; no media goes into Git.
Fetch/verify archives and members, create an unchanged-C oracle listening packet,
and compare each expanded Zig prototype numerically on the identical input.
"""
import argparse
import hashlib
import io
import json
import os
import pathlib
import random
import subprocess
import tarfile
import urllib.request
import zipfile
import numpy as np
import scipy.signal
import soundfile as sf
from pystoi import stoi

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache/audio-routes/corpus'
REVIEW = ROOT / '.cache/audio-routes/review'
OPTIONS = argparse.ArgumentParser(description=__doc__)
OPTIONS.add_argument("--inputs-only",action="store_true",help="Verify sources and render the latency input without rerunning unchanged offline quality/listening")
OPTIONS = OPTIONS.parse_args()
SOURCES = json.loads((ROOT/'docs/measurements/audio/audio-route-corpus-sources-2026-11-21.json').read_text())
CACHE.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def archive(item, name_key, hash_key):
    path = CACHE/item[name_key]
    if not path.exists():
        with urllib.request.urlopen(item.get('url'), timeout=60) as response, path.with_suffix('.part').open('wb') as out:
            while chunk := response.read(1024*1024):
                out.write(chunk)
        path.with_suffix('.part').replace(path)
    if digest(path.read_bytes()) != item[hash_key]:
        raise ValueError('Archive identity mismatch: '+path.name)
    return path

speech_archive = archive(SOURCES['speechArchive'], 'name', 'sha256')
needed = {s['archivePath']:s for s in SOURCES['speech']+[SOURCES['latencySpeech']] if not (CACHE/s['name']).exists()}
if needed:
    with tarfile.open(speech_archive, mode='r|gz') as tar:
        for member in tar:
            if member.name in needed:
                source = needed.pop(member.name)
                (CACHE/source['name']).write_bytes(tar.extractfile(member).read())
            if not needed:
                break
for source in SOURCES['noise']:
    path = archive(source, 'archiveName', 'archiveSha256')
    if not (CACHE/source['name']).exists():
        with zipfile.ZipFile(path) as z:
            (CACHE/source['name']).write_bytes(z.read(source['archivePath']))

def load(source, seconds):
    path = CACHE/source['name']
    if digest(path.read_bytes()) != source['sha256']:
        raise ValueError('Member identity mismatch: '+path.name)
    samples, rate = sf.read(path)
    if samples.ndim != 1:
        raise ValueError('Expected pinned mono source')
    return scipy.signal.resample_poly(samples[:int(rate*seconds)], 48000, rate)

noises = [load(s, 120) for s in SOURCES['noise']]
latency_clean=load(SOURCES['latencySpeech'],6)
latency_clean *= .07/np.sqrt(np.mean(latency_clean**2))
latency_noise=np.resize(noises[0],len(latency_clean))
latency_pcm=(latency_clean+latency_noise*(.07/10**.5/np.sqrt(np.mean(latency_noise**2)))).astype('<f4')
(CACHE/'latency-loop.f32').write_bytes(latency_pcm.tobytes())
latency_metadata={'path':'.cache/audio-routes/corpus/latency-loop.f32','sha256':digest(latency_pcm.tobytes()),'seconds':len(latency_pcm)/48000,'source':SOURCES['latencySpeech'],'noise':SOURCES['noise'][0],'rmsSpeech':.07,'snrDb':10,'policy':'Existing continuous-speech timing clip, no inserted noise-only padding; identical fixture for all compared routes. Representative quality remains separate.'}
(CACHE/'inputs.json').write_text(json.dumps({'latencyLoop':latency_metadata},indent=2)+'\n')
if OPTIONS.inputs_only:
    print(json.dumps(latency_metadata,indent=2))
    raise SystemExit(0)

rows, blind_key, review_rows, loop = [], [], [], []
rng = random.Random(1212)
for index, source in enumerate(SOURCES['speech']):
    clean = load(source, 4)
    clean *= .07 / np.sqrt(np.mean(clean**2))
    reference = np.pad(clean, (48000,48000))
    speech = slice(48000,48000+len(clean))
    tail = slice(len(reference)-33600,len(reference)-9600)
    for ni, noise_source in enumerate(SOURCES['noise']):
        noise = np.resize(noises[ni][index*48000:],len(reference))
        for snr in [0,10]:
            scaled = noise * (.07 / 10**(snr/20) / np.sqrt(np.mean(noise[speech]**2)))
            noisy = reference + scaled
            if np.max(np.abs(noisy)) >= 1:
                raise ValueError('Clipping in fixture')
            outputs = {}
            for variant in ['generic','zig-generic','zig-simd128']:
                env = os.environ.copy()
                if variant=='generic':
                    env.pop('AUDIO_EXPERIMENT',None)
                else:
                    env['AUDIO_EXPERIMENT']=variant
                    env['AUDIO_EXPERIMENT_MANIFEST']='.cache/audio-optimized/build.json'
                result = subprocess.run(['node','scripts/audio-quality-engine.mjs'],input=noisy.astype('<f4').tobytes(),capture_output=True,check=True,cwd=ROOT,env=env)
                outputs[variant] = np.frombuffer(result.stdout,dtype='<f4')
            wet=outputs['generic'].astype(float)
            numeric = {v:{'differentBits':int(np.count_nonzero(o.view('<u4')!=outputs['generic'].view('<u4'))),'maxAbsDifference':float(np.max(np.abs(o-outputs['generic'])))} for v,o in outputs.items()}
            input_stoi=stoi(clean,noisy[speech],48000,extended=False)
            for level,mix in [('light',.55),('standard',.75),('strong',1.)]:
                out=noisy*(1-mix)+wet*mix
                rows.append({'speaker':source['speaker'],'clip':source['name'],'noise':noise_source['name'],'snrDb':snr,'level':level,'inputStoi':float(input_stoi),'outputStoi':float(stoi(clean,out[speech],48000,extended=False)),'tailAttenuationDb':float(10*np.log10(np.mean(scaled[tail]**2)/max(np.mean(out[tail]**2),1e-20))),'clippedSamples':int(np.sum(np.abs(out)>1)),'finite':bool(np.isfinite(out).all()),'oracleComparison':numeric})
            if snr==10 and ni==index%2:
                loop.append(noisy)
            # Sixteen blinded comparisons, four speakers spanning both metadata categories.
            if index in [0,1,6,9]:
                case=f'case-{len(review_rows)+1:02d}'
                versions=[('clean',reference),('noisy',noisy),('C-strong',wet)]
                rng.shuffle(versions)
                for label,(kind,pcm) in zip('ABC',versions):
                    filename=f'{case}-{label}.wav';sf.write(REVIEW/filename,pcm,48000,subtype='PCM_16')
                    blind_key.append({'case':case,'label':label,'kind':kind,'sha256':digest((REVIEW/filename).read_bytes())})
                review_rows.append({'case':case,'speaker':source['speaker'],'noise':noise_source['name'],'snrDb':snr})
loop_pcm=np.concatenate(loop).astype('<f4');(CACHE/'mixed-loop.f32').write_bytes(loop_pcm.tobytes())
report={'latencyLoop':latency_metadata,'scope':'Ten deterministic LibriSpeech speakers (five F/five M corpus metadata), two actual DEMAND environments, 0/10 dB, three semantic levels; offline numeric evidence, not human listening, capture devices or universal speech/noise coverage. Media and derivatives remain local.','sources':SOURCES,'rows':rows,'loop':{'path':'.cache/audio-routes/corpus/mixed-loop.f32','sha256':digest(loop_pcm.tobytes()),'sampleRate':48000,'seconds':len(loop_pcm)/48000},'humanListening':'PENDING: no human scores supplied; never infer them from STOI or bit equality'}
(CACHE/'quality.json').write_text(json.dumps(report,indent=2)+'\n')
(REVIEW/'blind-key.json').write_text(json.dumps(blind_key,indent=2)+'\n')
(REVIEW/'cases.json').write_text(json.dumps(review_rows,indent=2)+'\n')
html='<!doctype html><meta charset="utf-8"><title>TASK-1.12 local blinded listening</title><h1>Local blinded listening — results pending</h1><p>Use the same headphones and volume. Rate each A/B/C for speech intelligibility (1–5), noise annoyance (1–5; 5 worst), speech distortion (1–5; 5 worst), and note missing syllables, metallic/robotic sound, clicks or discontinuities. Record preference and critical failures per case; do not open blind-key.json until finished. This packet is offline C-oracle quality, not live-browser continuity or a physical-device qualification.</p><p>LibriSpeech, Panayotov/Povey/Chen/Khudanpur, CC-BY-4.0, openslr.org/12; DEMAND, Thiemann/Ito/Vincent, CC-BY-SA-3.0, zenodo.org/records/1227121. Files and mixed derivatives are for this local review and are not uploaded or packaged.</p>'
for row in review_rows:
    html+=f'<h2>{row["case"]}</h2>'
    for label in 'ABC':
        html+=f'<p>{label} <audio controls preload="none" src="{row["case"]}-{label}.wav"></audio></p>'
(REVIEW/'index.html').write_text(html)
print(json.dumps({'cells':len(rows),'nonfiniteCells':sum(not r['finite'] for r in rows),'clippedSamples':sum(r['clippedSamples'] for r in rows),'differingPrototypeCells':sum(any(v['differentBits'] for v in r['oracleComparison'].values()) for r in rows),'listeningCases':len(review_rows),'loop':report['loop']},indent=2))
