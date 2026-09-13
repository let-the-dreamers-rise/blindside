// SPDX-License-Identifier: Apache-2.0

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./ui/theme.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("missing #root");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
