# Putting the demo somewhere

The app is a static build with a hash router, so it needs no server and no rewrite rules. Whatever
serves `app/dist` at any path will work: `base` is `./` in `app/vite.config.ts` precisely so the
same build runs from a project page, a subdirectory or a root domain without being rebuilt.

The build is fifty-one files and 78 MB, 65 MB of which is proving keys under `zk/`, the two
largest 19 MB each. Those are what let the browser prove a circuit from its own origin with no
server, and they are why cache headers matter here more than they usually do: fetched once with a
year of immutability, a second visit starts without touching them again. `vercel.json`,
`netlify.toml` and `app/public/_headers` each carry the same rule, so the headers travel with the
build instead of living in one host's dashboard.

The size is worth putting next to what a visitor actually pays, because they are not the same
number. The build is code split, and opening the site and playing a hunt fetches the page, the
app, the word list and the 1.3 MB on-chain runtime: about 1.8 MB in total. The proving keys and
the 10 MB ledger wasm are only reached by `#/live`, the console that talks to a real chain.

## Where it is now

**[playblindside.vercel.app](https://playblindside.vercel.app/)**, on Vercel, deployed from the
CLI as a finished static directory rather than built by Vercel from git. The build is already
proven on this machine and in CI, so uploading it skips reinstalling a pnpm workspace on somebody
else's infrastructure, and it needs no repository access at all.

Two details decide the address, and both are quiet about being wrong. The project name is taken
from the name of the directory that is uploaded, and the public address is `<project>.vercel.app`,
so the directory has to be called `playblindside`. And the CLI writes a `.vercel` link into
whatever directory it deployed, so a renamed copy of an earlier upload deploys to the old project
instead of the one its name implies. Delete it first.

```bash
pnpm --filter @blindside/app build && rm -rf /tmp/playblindside && cp -r app/dist /tmp/playblindside && cp vercel.json /tmp/playblindside/ && npx -y vercel@latest deploy /tmp/playblindside --prod --yes
```

Do not reach for `vercel alias set` to put a nicer name on a deployment. Under Standard Protection
only the production domain Vercel assigns itself is public; an alias pointed at a deployment
redirects to a Vercel login. The CLI reports success either way, and `curl` follows the redirect
to a page that is 200 and several hundred kilobytes, so it looks deployed from every angle except
the one that matters. Name the project correctly instead of aliasing.

To check a deploy without opening a browser, ask for the largest file and read the headers:

```bash
curl -sI https://playblindside.vercel.app/zk/keys/tag.prover | head -5
```

It should be `200`, about 19.5 MB, and `cache-control: public, max-age=31536000, immutable`.

For more than a spot check, point the browser suite at the deployed site instead of a local
preview. It is the same tests, playing whole hunts against the host:

```bash
BLINDSIDE_URL=https://playblindside.vercel.app pnpm --filter @blindside/app test
```

A local preview cannot fail the way a host fails. This is what catches a file that never got
uploaded, a header that came out wrong, or a route that turned out to need a rewrite.

## Vercel from git, if you want push-to-deploy

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
this repository can substitute for the grant. This is why the live site is uploaded rather than
built from git; the upload needs no grant and produces the same bytes.

1. Vercel, Add New, Project, Import Git Repository.
2. If `let-the-dreamers-rise/blindside` is not listed, use **Adjust GitHub App Permissions** and
   give Vercel access to it.
3. Deploy. Nothing else to fill in.

## Netlify

`netlify.toml` carries the build the same way and two sites exist, but this path is written down
unproven. Every deploy to this account is refused:

```
JSONHTTPError: Forbidden
```

The token reads and creates fine: `netlify-cli status` names the account, `sites:list` returns the
sites, and `sites:create` made a new one. Only the deploy call comes back 403, including a
single-file directory and a site the CLI had just created itself, which rules out both the 78 MB
upload and site ownership. That leaves something account-side that has to be settled in the
Netlify dashboard. Until it is, use Vercel.

## GitHub Pages

`.github/workflows/pages.yml` builds the same output on every push to `main` and publishes it as a
mirror. Nothing links to it; it exists so a second copy of the demo is always live and always
current, since the Vercel deploy above is run by hand. If the mirror is ever more trouble than it
is worth, deleting that one file retires it and changes nothing else.
