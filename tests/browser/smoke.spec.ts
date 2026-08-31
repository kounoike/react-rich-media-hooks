import { expect, test } from "@playwright/test";

test("secure-loopback entry point exposes browser diagnostics and stays SSR-safe", async ({
  page,
}) => {
  await page.goto("/tests/browser/index.html");

  const result = await page.evaluate(async () => {
    const moduleUrl = new URL("/dist/index.js", window.location.origin).href;
    const library = await import(moduleUrl);
    const session = library.createMediaSession();
    const started = await session.start();
    const snapshot = session.getSnapshot();
    await session.dispose();

    return {
      secureContext: window.isSecureContext,
      mediaDevices: typeof navigator.mediaDevices,
      getUserMedia: typeof navigator.mediaDevices?.getUserMedia,
      serverPhase: session.getServerSnapshot().phase,
      started: started.status,
      browserPhase: snapshot.phase,
      browserAvailability: snapshot.availability,
    };
  });

  expect(result.secureContext).toBe(true);
  expect(result.mediaDevices).toBe("object");
  expect(result.getUserMedia).toBe("function");
  expect(result.serverPhase).toBe("idle");
  expect(result.started).toBe("unsupported");
  expect(result.browserAvailability).toBe("unsupported");
});
