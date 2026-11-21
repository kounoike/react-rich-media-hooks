import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

test("records disposable denoising route evidence", async ({ page, browser }) => {
  test.skip(process.env.AUDIO_ROUTE_RESEARCH !== "1", "Opt-in architecture research only.");
  test.setTimeout(1_200_000);
  const mode = process.env.AUDIO_ROUTE_MODE ?? "capabilities";
  const isolated = process.env.AUDIO_ROUTE_ISOLATED !== "0";
  const config =
    mode === "profile"
      ? JSON.parse(readFileSync(".cache/audio-routes/stages.json", "utf8"))
      : { artifacts: {}, stages: [] };
  if (mode === "profile") {
    config.artifacts["c-control"] = { path: "src/effects/audio/assets/rnnoise.wasm" };
    config.artifacts["zig-affine-control"] = { path: ".cache/audio-zig/zig-simd128.wasm" };
    config.artifacts["zig-tiled-generic-control"] = {
      path: ".cache/audio-optimized/zig-generic.wasm",
    };
    config.artifacts["zig-tiled-simd-control"] = {
      path: ".cache/audio-optimized/zig-simd128.wasm",
    };
  }
  if (mode === "routes" || mode === "worklet" || mode === "comparison")
    config.artifacts = {
      c: { path: "src/effects/audio/assets/rnnoise.wasm" },
      zig: { path: ".cache/audio-zig/zig-simd128.wasm" },
      next: { path: ".cache/audio-optimized/zig-simd128.wasm" },
      "next-generic": { path: ".cache/audio-optimized/zig-generic.wasm" },
    };
  if (process.env.AUDIO_ROUTE_PRIVATE === "1")
    config.artifacts = { c: { path: "src/effects/audio/assets/rnnoise.wasm" } };
  const artifacts: Record<string, string> = {};
  const identities: Record<string, string> = {};
  if (mode === "profile" || mode === "routes" || mode === "worklet" || mode === "comparison") {
    for (const [name, artifact] of Object.entries(config.artifacts)) {
      if (
        typeof artifact !== "object" ||
        artifact === null ||
        !("path" in artifact) ||
        typeof artifact.path !== "string"
      )
        throw new Error("Invalid profile manifest");
      const bytes = readFileSync(artifact.path);
      identities[name] = createHash("sha256").update(bytes).digest("hex");
      artifacts[name] = `/research-model-${name}`;
      await page.route(`**/research-model-${name}`, (route) =>
        route.fulfill({ contentType: "application/wasm", body: bytes }),
      );
    }
  }
  if (mode === "routes" || mode === "comparison") {
    const input = readFileSync(process.env.AUDIO_ROUTE_INPUT ?? ".cache/audio-quality/speech.f32");
    identities.input = createHash("sha256").update(input).digest("hex");
    await page.route("**/research-input", (route) =>
      route.fulfill({ contentType: "application/octet-stream", body: input }),
    );
  }
  await page.route("**/tests/browser/research.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><button>Start research</button>",
      headers: isolated
        ? {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
          }
        : {},
    }),
  );
  for (const file of [
    "experiments/audio-routes/research.mjs",
    "experiments/audio-routes/inference-worker.mjs",
    "experiments/audio-routes/observer-worklet.mjs",
    "experiments/audio-routes/ring-worklet.mjs",
  ]) {
    identities["source:" + file] = createHash("sha256").update(readFileSync(file)).digest("hex");
    const response = await page.request.get("/" + file);
    if (!response.ok()) throw new Error("Missing served research source: " + file);
    identities["served:" + file] = createHash("sha256")
      .update(await response.body())
      .digest("hex");
  }
  await page.goto("/tests/browser/research.html");
  await page.getByRole("button", { name: "Start research" }).click();
  if (process.env.AUDIO_ROUTE_PRIVATE === "1")
    await page.evaluate(async () => {
      await import(
        new URL("/experiments/audio-routes/private-worker-setup.mjs", location.origin).href
      );
    });
  const result = await page.evaluate(
    async ({ method, options }) => {
      const research = await import(
        new URL(
          method === "comparison"
            ? "/experiments/audio-routes/compare-browser.mjs"
            : "/experiments/audio-routes/research.mjs",
          location.origin,
        ).href
      );
      if (research.PROTOCOL !== "audio-routes-v6")
        throw new Error("Stale research module; restart server");
      return research[method](options);
    },
    {
      method: mode,
      options: {
        artifacts,
        stages: config.stages,
        mode: process.env.AUDIO_ROUTE_TRIAL ?? "screen",
        windows: Number(process.env.AUDIO_ROUTE_WINDOWS ?? 8),
        duration: Number(process.env.AUDIO_ROUTE_DURATION ?? 600),
        startDelaySamples: Number(process.env.AUDIO_ROUTE_DELAY ?? 128),
        cases: process.env.AUDIO_ROUTE_CASES?.split(","),
      },
    },
  );
  const privateWorkers =
    process.env.AUDIO_ROUTE_PRIVATE === "1"
      ? JSON.parse(await page.evaluate<string>("JSON.stringify(window.privateWorkerEvidence)"))
      : undefined;
  await test.info().attach(`audio-route-${mode}.json`, {
    body: Buffer.from(
      JSON.stringify(
        {
          identities,
          privateWorkers,
          actualBrowserVersion: browser.version(),
          hostPlatform: process.platform,
          ...result,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
  expect(result.protocol).toBe("audio-routes-v6");
  if (mode === "comparison") {
    expect(result.variants).toHaveLength(4);
    for (const row of result.variants) {
      expect(row.differentBits).toBe(0);
      expect(row.probabilityMaxAbsDifference).toBe(0);
      expect(row.fixedMemoryEnforced).toBe(true);
    }
  }
});
