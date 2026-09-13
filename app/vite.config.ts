import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

// The compiled contract runs in the browser for Sandbox mode, so WebAssembly and top-level await
// both have to work. Targeting esnext means top-level await is native and needs no transform.
export default defineConfig({
  plugins: [react(), wasm()],
  server: { host: true, port: 5173 },
  build: { target: "esnext" },
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
});
