# Architecture

## The layers

```
core          WHEN something happens   packages/core            (pure TypeScript, no browser APIs)
  ↓
interaction   WHAT happens              apps/extension/src/overlay/interactions/
  ↓
stage         WHERE it's drawn          apps/extension/src/overlay/stage.ts
  ↓
character     WHO does it               packages/characters      (packs: monkey, …)
  ↓
renderer      HOW it's animated         packages/characters/src/renderers/
```

Each layer only talks to the one below it through a small interface. The Android app
will reuse `core` and the character packs, and bring its own stage.

## How the extension works

```
background service worker                      a limited site (e.g. youtube.com)
─────────────────────────                      ─────────────────────────────────
tracks which tab is in front      ◀─ status ─  watcher: "how long do I have?"
adds time to today's total                     sets a countdown
owns the clock and the log        ◀─ check ──  countdown done: "is it time?"
decides: slap, how hard           ── slap ──▶  overlay: stage + monkey + card
records the slap                  ◀─ leave ──  "Get me out of here"
```

- **Time counts** only while a limited site is the active tab of the focused Chrome
  window and the screen isn't locked. Watching a video without touching the mouse
  still counts.
- **Defaults**: new installs start with YouTube, Facebook, TikTok, Instagram, Reddit, X
  and LinkedIn at 5 min/day (`DEFAULT_SITES` in `packages/core/src/settings.ts`). Until the first
  real slap, every site slaps after 1 minute (`FIRST_SLAP_MINUTES`) so new users see it
  quickly.
- **Access**: Chrome grants the seven default sites at install (`host_permissions` in the
  manifest, so the install prompt lists them). Any other site is requested one at a
  time when the user adds it. The watcher script is registered only on limited sites.
  Other tabs are never seen. Removing a default site stops tracking it, but Chrome keeps
  the install-time access unless the user removes it in `chrome://extensions`.
- **Storage** (`chrome.storage.local`): `settings`, plus `usage` with one row per site
  per day `{ ms, slaps }`, kept for 90 days. That's the shape that will sync to Supabase.
- **Sign-in** runs in the service worker (`background/auth.ts`), because the popup
  closes when the Google window opens.

## The character contract

The app never draws a character. It only asks for named moves:

| Move | When it plays |
| --- | --- |
| `idle` | Standing around (loops) |
| `enter` | Arrives on screen from the side it's facing away from |
| `windup` | Pulls the arm back |
| `slap` | The swing; the hand ends at `hitPoint` |
| `taunt` | Laughs while the message card is shown |
| `exit` | Leaves the screen |
| `walk`, `sit`, `bark`, `cheer` | Reserved for future features; optional |

A **character pack** is a folder:

```
packages/characters/src/packs/monkey/
  character.json   id, name, renderer, size, hitPoint, facing, moves, sounds
  monkey.svg       the artwork (class names are the animation hooks)
  monkey.css       one keyframe animation per move
  index.ts         bundles the above and sets each move's duration
```

`hitPoint` is where the hand lands, as fractions of the artwork (0–1). The app lines it
up with the middle of the screen and puts the flash and handprint there, so a different
animal with a different shape just needs different numbers.

### Replacing the monkey

- **New art, same format (SVG + CSS):** edit `monkey.svg` and `monkey.css`. Nothing
  else changes.
- **A Rive or Lottie file:** write one renderer in `packages/characters/src/renderers/`
  (e.g. `rive.ts`), add the pack type to `CharacterPack`, and add a case in
  `createCharacter`. After that, every new character is just a new file.
- **Brief for a designer:** "One character, facing left, with these animations: idle
  (loop), enter, windup, slap, taunt, exit. Tell us where the hand is at the end of slap.
  Deliver as a Rive file with one state machine, or Lottie with one file per move."

### Adding another animal

Add a pack folder and register it in `packages/characters/src/registry.ts`. Users pick
one with `settings.characterId`. A character that's missing a move simply skips it.
Later, packs can be downloaded from Supabase Storage: Chrome extensions may download
art and data, but not code.

## Adding a feature (bark, walking companion, vocab quiz, mini-game)

1. Add its id to `InteractionId` in `packages/core/src/rules.ts`, and decide in
   `decide()` when it runs (e.g. bark at 80%, slap at 100%).
2. Write it in `apps/extension/src/overlay/interactions/` with the `Interaction`
   interface: it gets the stage, the character and the payload, and returns the
   user's choice.
3. Register it in `apps/extension/src/overlay/index.ts`.

Content such as vocab lists can live in Supabase and change without an extension
update. A new kind of game is new code, so it ships with an extension update.

## Testing

- `npm test` runs the core unit tests: domains, usage across midnight, sleep gaps,
  settings repair, limits and slap intensity.
- `apps/extension/src/demo/index.html` is a fake feed with a **Slap me** button, for
  tuning the animation. It's also where **Test the slap** goes on pages Chrome won't let
  extensions touch.
