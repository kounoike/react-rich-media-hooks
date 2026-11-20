"""Offline smoke, not representative/listening or browser qualification.
Run with the pinned uv command documented in docs/audio-processing.md.
Inputs are external CC-BY-4.0 LibriSpeech clips plus locally generated noise.
"""
import hashlib
import importlib.metadata
import json
import os
import pathlib
import subprocess

import numpy as np
import scipy.signal
import soundfile as sf
from pystoi import stoi

root = pathlib.Path(__file__).resolve().parent.parent
cache = root / ".cache/audio-quality"
sources = json.loads((root / "tests/fixtures/audio-quality-sources.json").read_text())
rows = []
for source in sources:
    path = cache / source["name"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError("Corpus identity mismatch")
    clean, rate = sf.read(path)
    clean = scipy.signal.resample_poly(clean, 48000, rate)[:48000 * 8]
    clean *= 0.07 / np.sqrt(np.mean(clean**2))
    reference = np.pad(clean, (48000, 48000))
    speech = slice(48000, 48000 + len(clean))
    tail = slice(len(reference) - 33600, len(reference) - 9600)
    for noise_kind in ["stationary-white", "bursts-and-hum"]:
        rng = np.random.default_rng(1212)
        noise = rng.normal(size=len(reference))
        if noise_kind == "bursts-and-hum":
            t = np.arange(len(reference)) / 48000
            noise = noise * (0.05 + (np.sin(t * 2 * np.pi * 2) > 0.85)) + 0.4 * np.sin(t * 2 * np.pi * 120)
        for snr in [0, 10]:
            scaled = noise * (np.sqrt(np.mean(clean**2)) / (10 ** (snr / 20)) / np.sqrt(np.mean(noise[speech]**2)))
            noisy = reference + scaled
            if np.max(np.abs(noisy)) >= 1:
                raise ValueError("Clipping in input fixture")
            result = subprocess.run(["node", "scripts/audio-quality-engine.mjs"], cwd=root,
                input=noisy.astype("<f4").tobytes(), capture_output=True, check=True)
            wet = np.frombuffer(result.stdout, dtype="<f4").astype(float)
            input_stoi = stoi(clean, noisy[speech], 48000, extended=False)
            for level, mix in [("light", 0.55), ("standard", 0.75), ("strong", 1.0)]:
                output = noisy * (1 - mix) + wet * mix
                if not np.all(np.isfinite(output)):
                    raise ValueError("Nonfinite output")
                attenuation = 10 * np.log10(np.mean(scaled[tail]**2) / max(np.mean(output[tail]**2), 1e-20))
                output_stoi = stoi(clean, output[speech], 48000, extended=False)
                snr_delta = 10 * np.log10(np.mean((noisy[speech] - clean)**2) / max(np.mean((output[speech] - clean)**2), 1e-20))
                rows.append({"clip": source["name"], "seconds": len(clean)/48000, "noise": noise_kind,
                    "inputSnrDb": snr, "level": level, "tailNoiseAttenuationDb": float(attenuation),
                    "inputStoi": float(input_stoi), "outputStoi": float(output_stoi),
                    "stoiDelta": float(output_stoi-input_stoi), "referenceErrorSnrDeltaDb": float(snr_delta),
                    "clippedSamples": int(np.sum(np.abs(output) > 1)),
                    "provisionalNumericGates": bool(attenuation >= 6 and output_stoi-input_stoi >= -0.03)})
report = {"scope": "Offline native-model smoke; three clips from one speaker, synthetic noises, no human listening or browser scheduling. Tail attenuation is measured on known speech-free noise, not speech-segment separation.",
    "variant": os.environ.get("AUDIO_EXPERIMENT", "generic"),
    "nativeArtifactSha256": hashlib.sha256((root / ((".cache/audio-zig/" + os.environ["AUDIO_EXPERIMENT"] + ".wasm") if os.environ.get("AUDIO_EXPERIMENT", "").startswith("zig-") else ".cache/audio-experiment/rnnoise-simd128.wasm" if os.environ.get("AUDIO_EXPERIMENT") == "simd128" else "src/effects/audio/assets/rnnoise.wasm")).read_bytes()).hexdigest(), "alignmentSamples": 960, "sampleRate": 48000, "seed": 1212, "sources": sources,
    "tools": {name: importlib.metadata.version(name) for name in ["numpy", "scipy", "soundfile", "pystoi"]}, "rows": rows}
out = root / os.environ.get("AUDIO_QUALITY_OUTPUT", ".artifacts/audio-quality.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2) + "\n")
for level in ["light", "standard", "strong"]:
    selected = [r for r in rows if r["level"] == level]
    print(level, "cells", len(selected), "numeric passes", sum(r["provisionalNumericGates"] for r in selected),
        "worst attenuation", round(min(r["tailNoiseAttenuationDb"] for r in selected), 3),
        "worst STOI delta", round(min(r["stoiDelta"] for r in selected), 4))
print(out)
