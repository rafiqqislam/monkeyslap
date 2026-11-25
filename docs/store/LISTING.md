# Chrome Web Store listing

Copy each block into the matching field of the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole). Images are in
[`docs/store/images/`](images/).

---

## Package

Upload: `apps/extension/release/monkeyslap-0.1.0-first-upload.zip`
(made with `npm run store:first -w @monkeyslap/extension`; for every later update use
`npm run store -w @monkeyslap/extension` and upload the zip without `-first-upload`).

---

## Store listing tab

**Name** (from the manifest): MonkeySlap

**Summary / short description** (max 132 characters):

```
Set a daily time limit on distracting sites. Go over it and a monkey slaps your screen. Scroll less, or get slapped.
```

**Category:** Productivity → Workflow & planning
**Language:** English

**Detailed description:**

```
Scroll less, or get slapped.

MonkeySlap gives distracting websites a daily time limit. Go over it, and a cartoon monkey swings onto your screen and slaps it. Then you choose: get out of there, or stay and get slapped again a few minutes later, a little harder each time.

HOW IT WORKS
• Ready from the start: YouTube, Facebook, TikTok, Instagram, Reddit, X and LinkedIn are limited to 5 minutes a day each.
• Your first slap comes after just 1 minute, so you see what MonkeySlap does straight away. After that, your real limits apply.
• Change any limit, switch sites off, or remove them, from the toolbar menu.
• Add any other site yourself. Chrome asks your permission for that site only, when you add it.
• Time only counts while the site is your front tab. Limits reset at midnight.

SEE YOUR HABITS
• Your profile shows today's time per site, your slaps, and a 7-day chart.

PRIVATE BY DEFAULT
• MonkeySlap only measures how long you spend on the sites in your list. It never reads page content and never sees any other site.
• Your data stays on your computer.
• Signing in with Google is optional. It backs up your settings and history so you can use them on another computer.
• No ads, no tracking, no selling data.

Privacy policy: https://monkeyslap.lol/privacy/
```

**Screenshots** (1280×800): `images/screenshot-1-slap.png` … `screenshot-4-welcome.png`, in that order.
**Small promo tile** (440×280): `images/promo-small-440x280.png`
**Store icon** (128×128): `apps/extension/public/icons/icon-128.png`

**Official URL / Homepage:** `https://monkeyslap.lol/`
**Support URL:** `https://monkeyslap.lol/support/`

---

## Privacy tab

**Single purpose:**

```
MonkeySlap limits how much time the user spends on distracting websites they have chosen: it measures time on those sites and shows a full-screen "slap" reminder when the user's daily limit is reached.
```

### Permission justifications

**storage**
```
Saves the user's list of limited sites, their daily limits and settings, and the minutes spent and number of slaps per site per day, on the user's computer.
```

**alarms**
```
Wakes the extension every 30 seconds while a limited site is open to add up time spent, and every 10 minutes to back up data for users who chose to sign in.
```

**idle**
```
Stops counting time while the computer's screen is locked, so time on a limited site is only counted while the user is actually there.
```

**scripting**
```
Shows the slap reminder on a limited site when the daily limit is reached. The small script that does this is registered only on the sites in the user's list, and is added to a site only after the user has granted access to it.
```

**activeTab**
```
Lets the "Test the slap" button in the toolbar menu show a demo slap on the tab the user is looking at, only when they click it.
```

**identity**
```
Used only for the optional "Sign in with Google" button, to open Google's sign-in window so the user can back up their settings and history. Not used unless the user clicks Sign in.
```

**Host permissions** (youtube.com, facebook.com, tiktok.com, instagram.com, reddit.com, x.com, linkedin.com, and optional access to other sites)
```
MonkeySlap's purpose is to limit time on distracting sites, so it needs to know when one of them is the active tab, and to show the slap on it when the limit is reached.

At install, access is requested only for seven common distracting sites, which start with a 5-minute daily limit (the user can change or switch off any of them).

Any other site is entirely the user's choice: when the user adds a site in the toolbar menu, Chrome asks their permission for that one site at that moment (optional host permission). Removing a site from the list stops all tracking of it and gives its access back.

On these sites, MonkeySlap only records which site is open and for how long. It never reads, stores or sends page content, page addresses, keystrokes or any data from other sites.
```

**Remote code:** **No, I am not using remote code.**
(All JavaScript is bundled in the package. The extension only sends and receives data, settings and daily totals, to its own database for users who sign in.)

### Data usage

Tick these boxes:

- [x] **Personally identifiable information**: name and email address (only when the user signs in with Google)
- [x] **Web history**: MonkeySlap records time spent per day on the specific sites the user limits. Google may count that as browsing activity, so disclosing it is the safe choice.
- [x] **User activity**: time on limited sites and number of slaps
- [ ] **Website content**: leave unticked. MonkeySlap never reads page content.
- [ ] **Authentication information**: leave unticked. MonkeySlap never sees the user's Google password; sign-in returns a session from Supabase.
- [ ] Health, financial and payment, personal communications, location: leave unticked

Then tick all three certifications:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
```
https://monkeyslap.lol/privacy/
```

---

## Distribution tab

- **Visibility:** Public
- **Regions:** All regions
- **Payment:** Free

---

## Notes for the reviewer (Account tab → "Notes for reviewer", or the test instructions field)

```
How to test MonkeySlap:
1. After install, a welcome tab opens. Click "Skip for now" (sign-in is optional).
2. Open youtube.com (or any of the 7 default sites) and keep it as the front tab. The first slap appears after 1 minute.
3. Or click the MonkeySlap icon → "Test the slap" to see it immediately on the current tab.
4. Click "Profile" in the toolbar menu to see time and slap stats.
No account is needed to test any feature. Optional Google sign-in backs up settings and daily totals.
```
