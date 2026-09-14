#!/usr/bin/env python3
"""Every repo path named in the docs has to exist.

A README that points at a file nobody can open is worse than one that says nothing: the reader
assumes the rest is wrong too. Run from the repository root.
"""

import glob
import os
import re
import sys

TICK = chr(96)
PATTERN = re.compile(TICK + r"([A-Za-z0-9_./-]+\.(?:json|ts|tsx|compact|mjs|yml|sh))" + TICK)


def main() -> int:
    missing = []
    checked = set()
    for doc in ["README.md", *sorted(glob.glob("docs/*.md"))]:
        with open(doc, encoding="utf-8") as handle:
            for path in PATTERN.findall(handle.read()):
                if (doc, path) in checked:
                    continue
                checked.add((doc, path))
                if not os.path.exists(path):
                    missing.append((doc, path))
    for doc, path in missing:
        print(f"missing: {path} (named in {doc})")
    print(f"{len(checked)} paths named, {len(missing)} missing")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
