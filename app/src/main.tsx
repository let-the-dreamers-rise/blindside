// SPDX-License-Identifier: Apache-2.0

// The Midnight wallet packages expect Node's Buffer. Providing it once here keeps every other
// module free of the detail.
import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./ui/theme.css";

globalThis.Buffer ??= Buffer;

const container = document.getElementById("root");
if (container === null) {
  throw new Error("missing #root");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
