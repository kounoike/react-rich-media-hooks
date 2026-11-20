import json
import pathlib
import sys
from audio_latency_analysis import summarize
print(json.dumps([summarize(json.loads(pathlib.Path(name).read_text())) for name in sys.argv[1:]], indent=2))
