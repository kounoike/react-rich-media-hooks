"""Fetch only the three hash-pinned external LibriSpeech development clips.
No archive member paths are extracted to disk. See the manifest for attribution.
"""
import hashlib
import json
import pathlib
import tarfile
import urllib.request
root = pathlib.Path(__file__).resolve().parent.parent
sources = json.loads((root / "tests/fixtures/audio-quality-sources.json").read_text())
cache = root / ".cache/audio-quality"
cache.mkdir(parents=True, exist_ok=True)
wanted = {item["archivePath"]: item for item in sources}
with urllib.request.urlopen(sources[0]["source"], timeout=45) as response:
    with tarfile.open(fileobj=response, mode="r|gz") as archive:
        for member in archive:
            if member.name not in wanted:
                continue
            item = wanted.pop(member.name)
            data = archive.extractfile(member).read()
            if hashlib.sha256(data).hexdigest() != item["sha256"]:
                raise ValueError("Corpus digest mismatch")
            (cache / item["name"]).write_bytes(data)
            if not wanted:
                break
if wanted:
    raise ValueError("Pinned corpus members were not found")
print("Three CC-BY-4.0 clips verified; no corpus media is committed or uploaded.")
