# React capture example

This standalone Vite app demonstrates a client-owned video capture session using the published `react-rich-media-hooks` package entry points. The application owns the controls and preview; the library owns the camera stream and keeps device discovery, capture state, and cleanup in the session.

## Run from a clean checkout

Use Node.js 20.19 or newer and pnpm 11.21.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir examples/capture install --frozen-lockfile
pnpm --dir examples/capture dev
```

The example links to the repository package through its public package exports. The `dev` script builds the library first, then serves the app at <http://127.0.0.1:5173>. The example has its own `pnpm-lock.yaml` and dependency manifest.

Run its standalone validation with:

```sh
pnpm --dir examples/capture typecheck
pnpm --dir examples/capture build
```

## Browser requirements

Open the local address in a supported desktop browser and allow camera access when prompted. Camera access requires a secure context; `localhost` and `127.0.0.1` are treated as secure local origins. This example requests video only. It does not use audio, upload media, or provide a browser compatibility guarantee beyond the library's documented support matrix. A physical or virtual camera is required for a live preview.

Before permission is granted, the browser may return a partial device list with redacted names. The app displays the session's fallback labels instead of treating device IDs as permanent hardware identifiers. After the initial `refreshDevices()` call, the session observes `devicechange` and publishes updated devices for the React picker. Selecting a camera while capture is active calls `switchDevice("video", { deviceId })` through the public API.

## Session and resource ownership

`CaptureSession` creates one `MediaSession` outside render-time browser work, requests the initial device list after mount, and disposes the session when the owner closes or unmounts it. `MediaSessionProvider`, `useMediaSession`, and `useMediaOutput("video")` connect the application UI to that owner. The preview attaches the session-owned stream and clears its `srcObject` when the output or preview element changes; attaching the stream does not transfer ownership.

Start, stop, retry, and device selection are explicit user actions. The UI renders the capture phase, availability, video activity, device discovery state, and typed session errors. Retry appears only for retryable errors; permission denial requires the user to change the browser permission before starting again. Disposing the session stops its acquired tracks. Create a new session to capture again after disposal.
