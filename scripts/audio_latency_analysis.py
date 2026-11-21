"""Frame-indexed latency scoring; measurement policy, not product runtime policy."""
import math
import numpy as np
from scipy.signal import correlate, correlation_lags

def distribution(values):
    values = sorted(float(value) for value in values)
    if not values:
        return {"count": 0, "p50": None, "p95": None, "p99": None, "max": None}
    return {"count": len(values), **{name: values[max(0, math.ceil(len(values)*ratio)-1)]
            for name, ratio in [("p50", .5), ("p95", .95), ("p99", .99)]}, "max": values[-1]}

def score_window(window, history, rate=16000, minimum_lag_ms=0):
    row = {key: value for key, value in window.items() if key not in ["a", "b"]}
    row.update({"accepted": False, "processed": False})
    if len(window["a"]) != rate or len(window["b"]) != rate or window["endFrame"]-window["startFrame"] != 48000:
        return {**row, "excluded": "incomplete-or-discontinuous-one-second-window"}
    if window.get("frameDiscontinuities", 0):
        return {**row, "excluded": "internal-render-frame-discontinuity"}
    if window.get("droppedWindows", 0):
        return {**row, "excluded": "collector-backpressure"}
    a = np.asarray(window["a"], dtype=float); b = np.asarray(window["b"], dtype=float)
    if not np.isfinite(a).all() or not np.isfinite(b).all():
        return {**row, "excluded": "nonfinite"}
    a -= a.mean(); b -= b.mean(); energy = np.linalg.norm(a)*np.linalg.norm(b)
    if energy < 1e-9:
        return {**row, "excluded": "silence"}
    correlations = correlate(b, a, mode="full", method="fft")/energy
    lags = correlation_lags(len(b), len(a)); selected = (lags >= rate*minimum_lag_ms/1000) & (lags <= rate*.3)
    index = int(np.argmax(correlations[selected])); peak = float(correlations[selected][index])
    row.update({"correlation": peak, "lagMs": float(lags[selected][index]/rate*1000), "accepted": peak >= .3})
    if peak < .3:
        return {**row, "excluded": "low-correlation"}
    if window["phase"].startswith("rnnoise-"):
        # Message arrival time does not label samples; align state events to capture frames.
        state = None; changes = []; previous = None
        for event in sorted(history, key=lambda event: event["frame"]):
            value = (event["status"], event["original"])
            if event["frame"] <= window["startFrame"]: state = value
            if previous is not None and value != previous and window["startFrame"]-256 <= event["frame"] <= window["endFrame"]+256:
                changes.append(event)
            previous = value
        if changes:
            return {**row, "accepted": False, "excluded": "processor-or-output-transition"}
        if state != ("active", False):
            return {**row, "path": "original-fallback", "processed": False}
        row.update({"processed": True, "path": "processed"})
    return row

def summarize(data):
    rows = [score_window(window, data["history"], data["captureRate"], data.get("minimumLagMs", 0)) for window in data["windows"]]
    controls = {}
    for delay in data.get("knownDelayMs", [0,30,60]):
        matching = [r for r in rows if r["phase"] == f"known-{delay}" and r["accepted"]]
        errors = [abs(r["lagMs"]-delay) for r in matching]
        controls[str(delay)] = {"windows": len(matching), "maxErrorMs": max(errors) if errors else None,
            "passed": len(matching) >= 2 and max(errors) <= .125}
    calibrated = all(control["passed"] for control in controls.values())
    phases = {}
    baseline = [r["lagMs"] for r in rows if r["phase"] == "original" and r["accepted"]]
    baseline_median = float(np.median(baseline)) if baseline else None
    for phase in dict.fromkeys(r["phase"] for r in rows):
        group = [r for r in rows if r["phase"] == phase]
        measured = [r["lagMs"] for r in group if r["accepted"] and (r["processed"] or not phase.startswith("rnnoise-"))]
        # Whole-phase qualification also rejects a later fallback, not just contaminated windows.
        start = min(r["startFrame"] for r in group)-48000; end=max(r["endFrame"] for r in group)
        events = [e for e in data["history"] if start <= e["frame"] < end]
        fallback = phase.startswith("rnnoise-") and any(e["status"] in ["degraded","failed","unsupported"] or (e["status"] == "active" and e["original"]) for e in events)
        qualified = calibrated and not fallback and baseline_median is not None and len(measured) >= (5 if phase.startswith("rnnoise-") else 2)
        phases[phase] = {"latencyMs": distribution(measured), "excludedWindows": len(group)-len(measured), "fallbackDuringCapture": fallback,
            "qualifiedProbe": qualified, "incrementalMs": distribution([x-baseline_median for x in measured]) if qualified and not phase.startswith("known-") else None}
    profiles = []
    for p in data["profiles"]:
        native = p["engineMs"]; callback = p["callbackMs"]
        profiles.append({"variant": p["variant"], "mode": p["mode"], "clock": p["clock"], "warmupFrames": p["warmupFrames"],
            "input": p["input"], "engineMs": distribution(native), "callbackMs": distribution(callback),
            "renderBudgetMs": p["renderBudgetMs"], "callbackBudgetExceedances": sum(t>p["renderBudgetMs"] for t in callback), "validation": p["validation"], "boundaryMicrobench": p.get("boundaryMicrobench")})
    return {key: value for key,value in data.items() if key not in ["windows","profiles"]} | {
        "method": f"exact 16000-sample/48000-frame producer windows; {data.get('minimumLagMs', 0)}..300ms normalized correlation; reject low energy, peak<0.3, discontinuity, collector drops, and state/output transitions within +/-256 frames; native qualification rejects whole-phase fallback; nearest-rank percentiles",
        "calibrated": calibrated, "knownDelayControls": controls, "baselineMedianMs": baseline_median, "phases": phases, "profiles": profiles, "windows": rows}
