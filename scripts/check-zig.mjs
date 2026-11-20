import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

// Git inventory includes newly added sources, excludes ignored build/dependency caches,
// handles spaces, and avoids requiring a build graph or target from TASK-1.12.
const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }).split("\0").filter((file) => /\.zig(?:\.zon)?$/.test(file) && existsSync(file)))].sort();
if (!files.length) {
  console.log("Zig checks: no sources; clean no-op.");
} else {
  function run(args) {
    const result = spawnSync("zig", args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  // One invocation per path avoids platform argument limits and shell interpretation.
  for (const file of files) {
    run(["fmt", "--check", `./${file}`]);
    if (file.endsWith(".zig")) run(["ast-check", `./${file}`]);
  }
  console.log(`Zig checks: ${files.length} source/manifest files passed fmt and source AST checks.`);
}
