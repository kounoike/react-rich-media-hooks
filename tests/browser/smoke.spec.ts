import { expect, test } from "@playwright/test";

test("secure-loopback capture acquires, exposes, and releases browser media", async ({ page }) => {
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    const moduleUrl = new URL("/dist/index.js", window.location.origin).href;
    const library = await import(moduleUrl);
    const session = library.createMediaSession({ capture: { video: true, audio: true } });
    const discovered = await session.refreshDevices();
    const started = await session.start();
    const snapshot = session.getSnapshot();
    const videoOutput = session.getOutput("video");
    const audioOutput = session.getOutput("audio");
    await session.stop();
    const stopped = session.getSnapshot();
    await session.dispose();

    return {
      secureContext: window.isSecureContext,
      mediaDevices: typeof navigator.mediaDevices,
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia,
      discovered: discovered.status,
      started: started.status,
      browserPhase: snapshot.phase,
      browserAvailability: snapshot.availability,
      activity: snapshot.activity,
      outputKinds: [videoOutput?.kind, audioOutput?.kind],
      stoppedPhase: stopped.phase,
      disposedPhase: session.getSnapshot().phase,
    };
  });

  expect(result.secureContext).toBe(true);
  expect(result.mediaDevices).toBe("object");
  expect(result.getUserMedia).toBe("function");
  expect(result.discovered).toBe("success");
  expect(result.started).toBe("success");
  expect(result.browserPhase).toBe("active");
  expect(result.browserAvailability).toBe("ready");
  expect(result.activity).toEqual({ video: "live", audio: "live" });
  expect(result.outputKinds).toEqual(["video", "audio"]);
  expect(result.stoppedPhase).toBe("idle");
  expect(result.disposedPhase).toBe("disposed");
});
