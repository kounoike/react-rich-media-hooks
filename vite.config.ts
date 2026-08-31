import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: {
        index: resolve(root, "src/index.ts"),
        "core/index": resolve(root, "src/core/index.ts"),
        "effects/video/index": resolve(root, "src/effects/video/index.ts"),
        "effects/audio/index": resolve(root, "src/effects/audio/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["react"],
    },
  },
});
