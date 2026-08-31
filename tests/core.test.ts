import { describe, expect, it } from "vitest";
import { createMediaSession } from "../src/core/index.js";

describe("createMediaSession", () => {
  it("starts with an SSR-safe server snapshot", () => {
    const session = createMediaSession();

    expect(session.getServerSnapshot()).toMatchObject({
      phase: "idle",
      availability: "unavailable",
      outputs: { video: null, audio: null },
    });
  });

  it("reports unsupported capture without touching browser globals", async () => {
    const session = createMediaSession();
    const result = await session.start();

    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") return;
    expect(result.error).toMatchObject({
      code: "unsupported",
      operation: "start",
      retryable: false,
    });
    expect(session.getOutput("video")).toBeNull();
  });

  it("notifies subscribers and clears them on disposal", async () => {
    const session = createMediaSession();
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    await session.dispose();
    unsubscribe();

    expect(notifications).toBe(1);
    expect(session.getSnapshot().phase).toBe("disposed");
  });
});
