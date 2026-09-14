# Putting the demo somewhere

The app is a static build with a hash router, so it needs no server and no rewrite rules. Whatever
serves `app/dist` at any path will work: `base` is `./` in `app/vite.config.ts` precisely so the
same build runs from a project page, a subdirectory or a root domain without being rebuilt.

## Vercel

`vercel.json` at the repository root already carries every build setting, so the project needs no
configuration in the dashboard. Leave Root Directory at the repository root; the file does the
rest:

| | |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm --filter @blindside/app build` |
| Output | `app/dist` |
| Framework | none, because the build is already exact |

Importing the repository is the only manual step, and it is manual for a reason: Vercel can only
see a repository once its GitHub App is installed on the account or organisation that owns it. For
this project that is **let-the-dreamers-rise**, and only somebody with admin on it can grant that.

1. Vercel, Add New, Project, Import Git Repository.
2. If `let-the-dreamers-rise/blindside` is not listed, use **Adjust GitHub App Permissions** and
   give Vercel access to it.
3. Deploy. Nothing else to fill in.

The first build takes a few minutes: `pnpm zk` copies 65 MB of proving keys into the output so the
browser console can prove circuits from its own origin. Fifty files, the largest 19 MB, 79 MB in
total.

## GitHub Pages

`.github/workflows/pages.yml` builds the same output and publishes it on every push to `main`. It
is how the demo has been reachable so far. Keep it until the Vercel URL is live, then retire it,
and change the links in `README.md`, `docs/SUBMISSION.md` and `app/src/screens/` in one pass so
nothing points at a dead host.
