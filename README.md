# MonkeySlap

Set a daily time limit on distracting sites. Go over it and a monkey slaps you.

This repo is a monorepo. Today it holds the Chrome extension; the Android app and the
web dashboard will live next to it and reuse the shared packages.

```
apps/
  extension/        Chrome extension (Manifest V3, Vite + CRXJS, React + Tailwind)
packages/
  core/             Platform-free rules: limits, usage, sessions, what happens at the limit
  characters/       The character contract, the monkey pack, and the renderers that animate it
site/               The website at https://monkeyslap.lol (homepage, privacy, support)
docs/
  ARCHITECTURE.md   How the pieces fit, and how to swap the monkey or add features
  SETUP.md          Supabase + Google sign-in setup
  store/            Chrome Web Store listing text and images
```

The website is plain HTML in `site/`. Cloudflare Pages publishes it to
`monkeyslap.lol` automatically whenever `site/` changes on `main`.

## Run it

Requires Node 22+ and npm.

```bash
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose `apps/extension/dist`.
3. Pin MonkeySlap from the puzzle-piece menu, open it, and add a site.

To try the slap right away, click **Test the slap** in the popup, or set a 1-minute
limit on a site and scroll there for a minute.

While developing, `npm run dev` rebuilds on every change and reloads the extension
(load `apps/extension/dist` the same way while it runs).

## Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the core logic (Vitest) |
| `npm run typecheck` | TypeScript checks for every package |
| `npm run zip -w @monkeyslap/extension` | Builds and zips the extension for the Chrome Web Store |
| `npm run icons -w @monkeyslap/extension` | Re-renders the PNG icons from `apps/extension/assets/icon.svg` |

## Google sign-in

Sign-in is optional, and everything else works without it. To turn it on, follow
[docs/SETUP.md](docs/SETUP.md) and put your keys in `apps/extension/.env`.

## Privacy, in short

- Nothing leaves your computer unless you sign in, and even then only daily totals per
  site will be synced (not built yet).
- The extension only gets access to the sites you choose to limit. Chrome asks you for
  each one. It never sees the rest of your browsing.
