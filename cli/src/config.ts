// Where the compiled contract's proving material lives. Networks come from @blindside/chain,
// which the browser console shares, so there is only one list of them anywhere.
// SPDX-License-Identifier: Apache-2.0

import path from "node:path";

export const currentDir = path.resolve(new URL(import.meta.url).pathname, "..");

export const contractConfig = {
  zkConfigPath: path.resolve(
    currentDir,
    "..",
    "..",
    "contract",
    "src",
    "managed",
    "blindside",
  ),
};
