// Turns the built index.html into a page that can be published as a hosted artifact, which
// supplies its own document skeleton and serves supporting files by relative path.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve(import.meta.dirname, "..", "dist");
const html = readFileSync(path.join(distDir, "index.html"), "utf8");

const find = (pattern) => {
  const match = html.match(pattern);
  if (match === null) {
    throw new Error(`the build output no longer contains ${pattern}`);
  }
  return match[1];
};

const script = find(/<script type="module"[^>]*src="\.\/([^"]+)"/);
const style = find(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/);
const title = find(/<title>([^<]+)<\/title>/);

const page = `<title>${title}</title>
<link rel="stylesheet" href="${style}">
<div id="root"></div>
<script type="module" src="${script}"></script>
`;

const out = path.join(distDir, "artifact.html");
writeFileSync(out, page);
console.log(`wrote ${path.relative(process.cwd(), out)} for ${script}`);
