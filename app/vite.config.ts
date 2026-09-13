import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

// The compiled contract runs in the browser for Sandbox mode, so WebAssembly and top-level await
// both have to work. Targeting esnext means top-level await is native and needs no transform.
export default defineConfig({
  plugins: [react(), wasm()],
  // Relative asset paths, so the same build works from a project page, a subdirectory, or a
  // host that serves it from somewhere other than the root.
  base: "./",
  // The wallet packages expect Node's Buffer. Without this the dev server treats "buffer" as a
  // builtin and externalizes it, which the build does not.
  resolve: { alias: { buffer: "buffer/" } },
  server: { host: true, port: 5173 },
  build: { target: "esnext" },
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
});
