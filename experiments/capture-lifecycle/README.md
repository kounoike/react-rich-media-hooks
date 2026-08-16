# Disposable capture lifecycle experiment

This directory is an isolated research artifact for TASK-1.3. It intentionally
does not import or modify the production package (which does not exist yet),
adds no runtime dependencies, and must not be promoted into a public API.

## What is included

- `run.mjs` is a deterministic Node harness with fake `MediaDevices`, streams,
  tracks, request completions, device loss, and ownership. It models the React
  effect setup/cleanup boundaries and runs five scenarios with 41 assertions.
- `index.html` is a manual witness using the real React 18.3.1 development UMD
  build and a `React.StrictMode` root. Its fake media controls make duplicate
  requests, stale completion, rejection, rerender, unmount, and external track
  ending visible in the event log. React is loaded from a CDN only for this
  disposable page.
- The full dated observations, responsibility split, and approval-gated API
  implications are recorded in Backlog document doc-3, “Capture Lifecycle
  Experiment Findings”.

## Deterministic run

From the repository root:

```sh
node --check experiments/capture-lifecycle/run.mjs
node experiments/capture-lifecycle/run.mjs
```

Success prints `CAPTURE_LIFECYCLE_EXPERIMENT_PASS` followed by a JSON report
with scenario/event counts and the policies under test. A failure exits with a
non-zero status and prints the failed assertion.

## Browser reproduction

The page needs network access for the React 18.3.1 development UMD scripts.
Serve this directory from a local HTTP origin (rather than opening the file
directly):

```sh
python3 -m http.server 6420 --directory experiments/capture-lifecycle
```

Open `http://127.0.0.1:6420/index.html` in a browser. The initial render is
inside `React.StrictMode`, so the event log shows the development effect probe:
`setup -> cleanup -> setup`, with two pending fake `getUserMedia` requests.
Use the controls to:

1. Resolve the oldest request after the Strict Mode probe and confirm its stream
   is logged as stale and stopped.
2. Resolve the latest request and confirm only the current stream is attached.
3. Change constraints, then resolve the latest request; the old stream remains
   live until the replacement succeeds and is then stopped.
4. Reject a request as `NotAllowedError` or `NotFoundError` and compare the
   typed failure entries.
5. Simulate device removal and confirm the browser `ended` event is distinct
   from library cleanup via `track.stop()`.
6. Unmount and remount the consumer to inspect cleanup and a fresh request.

The browser page is a lifecycle witness, not a claim that fake media behaves
like every physical camera or microphone. Use `run.mjs` for the repeatable
failure, ownership, sharing, partial-acquisition, retry, and assertion matrix.
