import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "../core"),
    },
  },
  server: {
    // core/ lives outside webapp/, so Vite's dev server needs to be told
    // it's allowed to read files from the parent (project root) directory.
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
  build: {
    outDir: "dist",
  },
});
