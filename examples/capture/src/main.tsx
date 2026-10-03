import * as React from "react";
import type { ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  createMediaSession,
  MediaSessionProvider,
  useMediaOutput,
  useMediaSession,
} from "react-rich-media-hooks";
import "./styles.css";

interface CaptureSessionProps {
  readonly onDisposed: () => void;
}

function CaptureSession({ onDisposed }: CaptureSessionProps) {
  const [session] = React.useState(() =>
    createMediaSession({ capture: { video: true, audio: false } }),
  );

  React.useEffect(() => {
    void session.refreshDevices();
    return () => {
      void session.dispose();
    };
  }, [session]);

  return (
    <MediaSessionProvider session={session}>
      <CapturePanel onDisposed={onDisposed} />
    </MediaSessionProvider>
  );
}

function CapturePanel({ onDisposed }: CaptureSessionProps) {
  const { session, snapshot } = useMediaSession();
  const { output } = useMediaOutput("video");
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement !== null) videoElement.srcObject = output?.stream ?? null;
    return () => {
      if (videoElement !== null) videoElement.srcObject = null;
    };
  }, [output]);

  const handleDeviceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.currentTarget.value;
    if (deviceId.length > 0) void session.switchDevice("video", { deviceId });
  };

  const handleDispose = async () => {
    await session.dispose();
    onDisposed();
  };

  const isSwitching = snapshot.operation?.operation === "switch";
  const canStart =
    snapshot.phase !== "active" && snapshot.phase !== "requesting" && snapshot.phase !== "disposed";
  const canStop = snapshot.phase === "active" || snapshot.phase === "requesting";

  return (
    <div className="capture-layout">
      <section className="preview-card" aria-label="Local camera preview">
        <div className="preview-frame">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Camera preview"
            data-phase={snapshot.phase}
          />
          {output === null && (
            <div className="preview-placeholder">
              <span className="camera-mark" aria-hidden="true">
                ◉
              </span>
              <p>Your local preview will appear here.</p>
            </div>
          )}
          <span className={`phase-pill phase-${snapshot.phase}`}>
            <span className="phase-dot" aria-hidden="true" />
            {snapshot.phase}
          </span>
        </div>

        <div className="preview-caption">
          <div>
            <p className="eyebrow">SESSION OWNED OUTPUT</p>
            <p className="caption-title">Camera preview</p>
          </div>
          <p className="output-state">
            {output === null ? "No active stream" : "Live · local only"}
          </p>
        </div>
      </section>

      <section className="control-card" aria-labelledby="controls-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">APPLICATION CONTROLS</p>
            <h2 id="controls-heading">Capture session</h2>
          </div>
          <span className={`status-badge status-${snapshot.availability}`}>
            {snapshot.availability}
          </span>
        </div>

        <div className="action-row">
          <button
            className="button button-primary"
            type="button"
            disabled={!canStart}
            onClick={() => void session.start()}
          >
            Start camera
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={!canStop}
            onClick={() => void session.stop()}
          >
            Stop
          </button>
          {snapshot.error?.retryable && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void session.retry()}
            >
              Retry
            </button>
          )}
        </div>

        <div className="device-section">
          <div className="device-heading">
            <div>
              <label htmlFor="camera-select">Camera device</label>
              <p>Choose an active camera. The list refreshes when devices change.</p>
            </div>
            <span className={`discovery-status discovery-${snapshot.deviceDiscovery}`}>
              {snapshot.deviceDiscovery}
            </span>
          </div>
          <select
            id="camera-select"
            value={snapshot.selectedDevices.video ?? ""}
            disabled={
              snapshot.phase !== "active" || snapshot.devices.video.length === 0 || isSwitching
            }
            onChange={handleDeviceChange}
          >
            <option value="">
              {snapshot.devices.video.length === 0 ? "No cameras discovered" : "Select a camera"}
            </option>
            {snapshot.devices.video.map((device, index) => (
              <option key={device.deviceId || `camera-${index}`} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
                {device.labelState === "redacted" ? " · permission needed for name" : ""}
              </option>
            ))}
          </select>
          <p className="device-note">
            {snapshot.phase === "active"
              ? `${snapshot.devices.video.length} camera${snapshot.devices.video.length === 1 ? "" : "s"} available`
              : "Start capture to switch cameras. Device names may be limited before permission is granted."}
          </p>
        </div>

        <dl className="session-facts">
          <div>
            <dt>Video activity</dt>
            <dd>{snapshot.activity.video}</dd>
          </div>
          <div>
            <dt>Device discovery</dt>
            <dd>{snapshot.deviceDiscovery}</dd>
          </div>
          <div>
            <dt>Output ownership</dt>
            <dd>{output?.ownership ?? "not created"}</dd>
          </div>
        </dl>

        <output className="live-message" aria-live="polite">
          {snapshot.phase === "requesting"
            ? "Waiting for camera permission…"
            : snapshot.phase === "active"
              ? "Camera capture is active. Stop the session when you are finished."
              : snapshot.phase === "disposed"
                ? "This session has been disposed."
                : "Camera access starts only after you press Start camera."}
        </output>

        {snapshot.error !== null && (
          <div className="error-panel" role="alert">
            <div className="error-heading">
              <span className="error-indicator" aria-hidden="true">
                !
              </span>
              <strong>{snapshot.error.code}</strong>
            </div>
            <p>{snapshot.error.message}</p>
            <span>
              {snapshot.error.retryable
                ? "Retry is available."
                : "Check browser permission and device availability."}
            </span>
          </div>
        )}

        <button className="dispose-button" type="button" onClick={() => void handleDispose()}>
          Dispose session
          <span>· stops session-owned tracks</span>
        </button>
      </section>
    </div>
  );
}

function App() {
  const [sessionOpen, setSessionOpen] = React.useState(true);

  return (
    <main className="page-shell">
      <header className="page-header">
        <a className="wordmark" href="https://github.com/kounoike/react-rich-media-hooks">
          <span className="wordmark-icon" aria-hidden="true">
            r+
          </span>
          <span>react-rich-media-hooks</span>
        </a>
        <span className="header-tag">CAPTURE EXAMPLE</span>
      </header>

      <section className="intro">
        <p className="eyebrow">LOCAL MEDIA · REACT API</p>
        <h1>Capture, observe, and release.</h1>
        <p className="intro-copy">
          A small application-owned camera flow built with the public React API. Capture starts only
          after an explicit action, and the session owns everything it acquires.
        </p>
      </section>

      {sessionOpen ? (
        <CaptureSession onDisposed={() => setSessionOpen(false)} />
      ) : (
        <section className="new-session-card">
          <p className="eyebrow">SESSION RELEASED</p>
          <h2>Camera resources stopped.</h2>
          <p>Create a fresh session when you want to try the capture flow again.</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setSessionOpen(true)}
          >
            Create a new session
          </button>
        </section>
      )}

      <footer className="page-footer">
        <span>Camera access stays in this browser.</span>
        <span>Session owned · no media upload</span>
      </footer>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("Missing #root mount element.");
createRoot(rootElement).render(<App />);
