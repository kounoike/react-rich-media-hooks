import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";

const copyDeclarations = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await copyDeclarations(path);
    } else if (entry.name.endsWith(".d.ts")) {
      await cp(path, path.replace(/\.d\.ts$/, ".d.cts"));
    }
  }
};

await copyDeclarations("dist");
