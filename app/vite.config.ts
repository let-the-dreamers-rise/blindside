import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

const here = path.dirname(fileURLToPath(import.meta.url));
const shim = (name: string): string => path.resolve(here, "src", "shims", `${name}.ts`);

// The compiled contract runs in the browser for Sandbox mode, so WebAssembly and top-level await
// both have to work. Targeting esnext means top-level await is native and needs no transform.
export default defineConfig({
  plugins: [react(), wasm()],
  // Relative asset paths, so the same build works from a project page, a subdirectory, or a
  // host that serves it from somewhere other than the root.
  base: "./",
  resolve: {
    alias: {
      // The wallet packages expect Node's Buffer. Without this the dev server treats "buffer" as
      // a builtin and externalizes it, which the build does not.
      buffer: "buffer/",
      // The private state store is built on Node's EventEmitter. Without the polyfill the class
      // it extends is undefined and the module throws on load.
      events: "events/",
      // Two things the wallet SDK and the indexer provider reach for that a browser already has.
      // Left alone, the bundler stubs them out and they fail at run time rather than at build.
      "node:crypto": shim("node-crypto"),
      crypto: shim("node-crypto"),
      "isomorphic-ws": shim("isomorphic-ws"),
    },
  },
  server: { host: true, port: 5173 },
  build: { target: "esnext" },
  esbuild: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
});
