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
Every attempt to link it from a tool fails at that step, and no amount of build configuration in
this repository can substitute for the grant.

1. Vercel, Add New, Project, Import Git Repository.
2. If `let-the-dreamers-rise/blindside` is not listed, use **Adjust GitHub App Permissions** and
   give Vercel access to it.
3. Deploy. Nothing else to fill in.

The first build takes a few minutes: `pnpm zk` copies 65 MB of proving keys into the output so the
browser console can prove circuits from its own origin. Fifty files, the largest 19 MB, 79 MB in
total.

## Netlify

`netlify.toml` carries the build the same way, and a site is already waiting: **blindside-hunt**,
id `9662c864-bec7-4945-9ae7-b38bafcea292`, which will serve
[blindside-hunt.netlify.app](https://blindside-hunt.netlify.app) once something is deployed to it.
It is set to need no password and no team login, so anybody with the link can play.

Build here and upload the result, rather than letting Netlify build: the build is already proven
on this machine and on CI, and uploading `app/dist` skips reinstalling a workspace on somebody
else's infrastructure.

```bash
npx -y netlify-cli login
```

```bash
cd /root/code/blindside && pnpm --filter @blindside/app build && npx -y netlify-cli deploy --prod --dir app/dist --site 9662c864-bec7-4945-9ae7-b38bafcea292
```

The upload is 79 MB, most of it proving keys, so give it a few minutes.

## GitHub Pages

`.github/workflows/pages.yml` builds the same output and publishes it on every push to `main`. It
is how the demo has been reachable so far. Keep it until the Vercel URL is live, then retire it,
and change the links in `README.md`, `docs/SUBMISSION.md` and `app/src/screens/` in one pass so
nothing points at a dead host.
