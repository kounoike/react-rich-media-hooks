"""Summarize 1-second paired loopback windows, rejecting low-correlation estimates.
Input is the decoded audio-loopback.json Playwright attachment, not a report wrapper.
"""
import json
import pathlib
import sys

import numpy as np
import scipy.signal

rows = []
for name in sys.argv[1:]:
    data = json.loads(pathlib.Path(name).read_text())
    measurements = []
    for window in data["windows"]:
        if window["phase"] not in ["baseline", "processed"]:
            continue
        a = np.asarray(window["a"], dtype=float)
        b = np.asarray(window["b"], dtype=float)
        a -= np.mean(a)
        b -= np.mean(b)
        denominator = np.linalg.norm(a) * np.linalg.norm(b)
        if denominator < 1e-9:
            continue
        correlation = scipy.signal.correlate(b, a, mode="full", method="fft") / denominator
        lags = scipy.signal.correlation_lags(len(b), len(a))
        selected = (lags >= 0) & (lags <= data["captureRate"] * 0.3)
        index = int(np.argmax(correlation[selected]))
        peak = float(correlation[selected][index])
        measurements.append({"phase": window["phase"], "correlation": peak,
            "lagMs": float(lags[selected][index] / data["captureRate"] * 1000), "accepted": peak >= 0.3})
    baseline = [m["lagMs"] for m in measurements if m["phase"] == "baseline" and m["accepted"]]
    processed = [m["lagMs"] for m in measurements if m["phase"] == "processed" and m["accepted"]]
    valid = data["addedStatus"] == "success" and data["finalStatus"] == "active" and len(baseline) >= 3 and len(processed) >= 5
    summary = {key: value for key, value in data.items() if key != "windows"}
    summary.update({"source": name, "method": "0..300ms normalized cross-correlation on paired 16kHz one-second windows; reject peak <0.3; subtract median original-track baseline; synthetic loopback only",
        "measurements": measurements, "qualifiedLoopbackEstimate": valid,
        "baselineMedianMs": float(np.median(baseline)) if baseline else None,
        "incrementalP50Ms": float(np.median(processed)-np.median(baseline)) if valid else None,
        "incrementalP95Ms": float(np.percentile(processed,95,method="higher")-np.median(baseline)) if valid else None})
    rows.append(summary)
print(json.dumps(rows, indent=2))
