import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const launcher = fileURLToPath(
  new URL("../scripts/video-crop-reference-device.mjs", import.meta.url),
);
const invoke = (...args: string[]): string =>
  execFileSync(process.execPath, [launcher, ...args], { encoding: "utf8", stdio: "pipe" });

describe("reference-device launcher guards", () => {
  it("documents manual camera operation before starting a browser", () => {
    expect(invoke("--help")).toContain("physical camera");
    expect(invoke("--", "--help")).toContain("physical camera");
  });
  it("requires synthetic input before automatic or headless runs", () => {
    expect(() => invoke("--autorun")).toThrow();
    expect(() => invoke("--headless")).toThrow();
  });
  it("rejects unrelated origins and incomplete commit identities", () => {
    expect(() =>
      invoke("--url", "https://example.com/tests/browser/video-crop-benchmark.html"),
    ).toThrow();
    expect(() => invoke("--commit", "a40114c")).toThrow();
    expect(() => invoke("--url", "http://localhost:4174/other.html")).toThrow();
  });
});
