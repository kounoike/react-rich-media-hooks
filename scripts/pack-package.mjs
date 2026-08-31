import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputDirectory = ".artifacts";
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["pack", "--pack-destination", outputDirectory], { stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
