// Copies the compiled proving material next to the app, so a browser can fetch it.
//
// These are 65 MB of prover keys. They are build output, not source, so they are never committed;
// this runs before dev and before build, and the app serves them from its own origin. A browser
// fetches one only when it is about to prove that circuit.
// SPDX-License-Identifier: Apache-2.0

import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.resolve(here, "..", "..", "contract", "src", "managed", "blindside");
const to = path.resolve(here, "..", "public", "zk");

const DIRECTORIES = ["keys", "zkir"];

if (!existsSync(from)) {
  console.error(
    `\n  No compiled contract at ${from}.\n  Run: pnpm compact\n`,
  );
  process.exit(1);
}

let bytes = 0;
for (const directory of DIRECTORIES) {
  const source = path.join(from, directory);
  if (!existsSync(source)) {
    console.error(`\n  The compiled contract has no ${directory}. Run: pnpm compact\n`);
    process.exit(1);
  }
  await mkdir(path.join(to, directory), { recursive: true });
  await cp(source, path.join(to, directory), { recursive: true });

  for (const entry of await readdir(source)) {
    bytes += (await stat(path.join(source, entry))).size;
  }
}

console.log(
  `  zk assets: ${(bytes / 1024 / 1024).toFixed(1)} MB ready at app/public/zk`,
);
