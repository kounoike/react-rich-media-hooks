"""Decode opt-in evidence without hiding state, failures or excluded windows.
Never upload raw PCM: committed summaries contain scalar/window metadata only.
"""
import base64
import json
import pathlib
import sys
import numpy as np
from audio_latency_analysis import summarize

reports = []
for filename in sys.argv[1:]:
    data = json.loads(pathlib.Path(filename).read_text())
    for window in data['windows']:
        if window.get('encoding') == 'base64-f32le':
            for channel in ['a', 'b']:
                window[channel] = np.frombuffer(base64.b64decode(window[channel]), dtype='<f4')
    data.setdefault('profiles', [])
    report = summarize(data)
    for row in report['results']:
        stats = row.get('closed', {}).get('stats') or {}
        phase = report['phases'].get('rnnoise-'+row['name'], {})
        samples = stats.get('sourceSamples')
        row['qualification'] = {
            'sixtyAcceptedProcessedWindows': phase.get('latencyMs', {}).get('count', 0) >= 60 and phase.get('qualifiedProbe', False),
            'addedP95Within40Ms': phase.get('incrementalMs') is not None and phase['incrementalMs']['p95'] <= 40,
            'denoisingActive600Seconds': row.get('activeSeconds', 0) >= 600 and not row.get('fault') and not row.get('error'),
            'observedStable600SecondsWithoutMissingFrames': row.get('stableSeconds', 0) >= 600 and not row.get('fault') and not row.get('error') and all((row.get('stableContinuity') or {}).get(k, 1)==0 for k in ['frameGaps','missingReference','missingOutput','nonfinite']),
            'cloneSurvives150MsAfterClose': row.get('cloneInitiallyLive', False) and row.get('cloneLiveAfterClose', False),
            'humanListening': 'PENDING',
            'physicalDeviceQualification': 'PENDING',
        }
        if samples is not None:
            row['rawThroughput'] = {
                'sourceSeconds': samples/48000,
                'renderedSeconds': row.get('activeSeconds'),
                'unwrittenSourceRemainderSamples': samples-stats['outputSamples'],
                'timestampSpanSeconds': (stats['lastEnd']-stats['firstTimestamp'])/1e6,
                'timestampDeltaSumSeconds': stats['timestampDeltaSum']/1e6,
                'timestampJitterEventsNotProvenDropouts': stats['gaps'],
            }
    reports.append(report)
print(json.dumps(reports, indent=2))
