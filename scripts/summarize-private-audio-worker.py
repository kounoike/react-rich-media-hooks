"""Summarize bounded private Worker diagnostics without exporting PCM.

Accepts collect-native-audio-routes.py or AUDIO_ROUTE_PRIVATE Playwright JSON.
Worker model times are not Worklet callback duration or end-to-end latency.
"""
import hashlib
import json
import math
import pathlib
import sys


def distribution(values):
    values = sorted(values)
    if not values:
        return {"count": 0}
    return {
        "count": len(values),
        "p50": values[max(0, math.ceil(len(values) * .5) - 1)],
        "p95": values[max(0, math.ceil(len(values) * .95) - 1)],
        "p99": values[max(0, math.ceil(len(values) * .99) - 1)],
        "max": values[-1],
    }


reports = []
for filename in sys.argv[1:]:
    path = pathlib.Path(filename)
    raw = path.read_bytes()
    data = json.loads(raw)
    workers = data.get("privateWorkers", data.get("workers", []))
    records = []
    for worker in workers:
        times = worker.get("processingMs", [])
        diagnostics = worker.get("diagnostics", [])
        records.append({
            "url": worker["url"],
            "nativePreparationAcknowledged": worker.get("prepared", "not instrumented"),
            "ready": worker.get("ready", []),
            "faults": worker.get("faults", []),
            "activeFaults": [row for row in worker.get("faults", []) if not row.get("duringClose")],
            "stopAcknowledged": worker.get("stopped", False),
            "engineMs": distribution(times),
            "workerOnlyComparisonsAbove2_667MsNotWorkletMisses": sum(t > 128 / 48 for t in times),
            "recordingCapacity": 90000,
            "recordingCapacityReached": len(times) >= 90000,
            "diagnosticSnapshots": len(diagnostics),
            "firstDiagnostics": diagnostics[0] if diagnostics else None,
            "lastDiagnostics": diagnostics[-1] if diagnostics else None,
        })
    heap = data.get("windowHeapSamples", data.get("memory", []))
    heap_values = [row["heap"] for row in heap if row.get("heap") is not None]
    reports.append({
        "rawReportSha256": hashlib.sha256(raw).hexdigest(),
        "workers": records,
        "windowExposedHeapProbe": {
            "samples": len(heap),
            "firstBytes": heap_values[0] if heap_values else None,
            "lastBytes": heap_values[-1] if heap_values else None,
            "minimumBytes": min(heap_values) if heap_values else None,
            "maximumBytes": max(heap_values) if heap_values else None,
            "limit": "Measurement retains PCM windows and diagnostic arrays; this is not Worker-attributable or whole-process memory qualification.",
        },
    })
print(json.dumps(reports, indent=2))
