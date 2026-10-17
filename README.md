# Pet Tracker (mobile app)

Expo / React Native app for tracking a pet's feedings, walks, baths, weight and vet / vaccination / flea-tick-worming care. Talks to [pet-tracker-backend](../pet-tracker-backend) (Laravel, `/api/v1`).

## Setup

```bash
npm install
cp .env.example .env.local     # set EXPO_PUBLIC_API_URL
npm start                      # then press i / a / w
```

`EXPO_PUBLIC_API_URL` is the backend's `/api` root (for example `http://192.168.1.20:8000/api` when testing on a phone on the same Wi-Fi). The app appends the API version (`/v1`) itself. Use `https://` anywhere outside local development.

npm is the package manager (`package-lock.json`); don't add other lockfiles.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Jest unit tests (`jest-expo`) |
| `npm run verify` | Typecheck + tests, the same as CI |

## Structure

```
App.tsx                 navigation + providers
src/api/                client.ts (fetch wrapper: auth header, timeout, GET retry, errors),
                        tokenStorage.ts (SecureStore), userCache.ts (wipe on logout)
src/context/            Auth, Pet (feedings/walks/baths/weights + paging), Care, Reminders
src/screens/            one file per tab
src/components/         shared UI (activity log, weight chart, forms)
src/i18n/               nb / en strings
```

## Design system

Quiet and precise: surfaces separate by tone (never borders), primary actions are ink, and one warm honey accent (from Toya's coat) marks data and state, never decoration.

- `src/theme.ts`: light and dark palettes, the type scale (`type`), radii (`radius`, `smooth`) and 4pt spacing (`space`). Use these, not literals.
- `src/components/ui.tsx`: `Screen` (large title, safe area, pull-to-refresh), `Surface`, `Group` (rows with hairlines), `Section`, `Row`, `PressScale`.
- `src/components/AppButton.tsx`: the one button (`primary` ink, `secondary` tonal, `ghost`), all with the same press feel.
- `src/components/themed.tsx`: `Text` takes `variant` (a step of the type scale) and `tone`.
- There is no header bar: each page opens with its own large title, and logout lives in Profile.

## Behaviour worth knowing

- **Auth:** bearer token in SecureStore; any 401 (except on login/register) logs the user out. Signing out wipes the cached pet and care data.
- **Offline:** pet data and care records are cached per pet and shown immediately while the network refreshes. Reads are retried once; writes never are, so a slow save can't create duplicates. Requests time out after 15 seconds.
- **Long histories:** feedings and walks load 100 entries and fetch the next 100 as you scroll. Weights load up to 500 for the chart.
- **Reminders:** local notifications (feeding, walk, weekly weigh-in). The feeding and walk times are each person's own setting (Profile, saved on the server as `HH:MM`). A day's reminder is only scheduled if its time is still ahead and, for today, nothing has been logged yet. The schedule is rebuilt whenever data or settings change, and when the app returns to the foreground (after a quiet refresh, so a co-owner's entry cancels today's reminder). Two phones can't know about each other's entries until one of them opens the app.
- **Bath interval:** days between baths is a setting on the dog (Profile), shared by everyone who owns it; the default is 30.
- **Co-owner pushes:** when another owner feeds or walks the dog, the server pushes "Benjamin fed Toya" (Profile has a switch, shown when the dog has more than one owner). The app registers its Expo push token after sign-in once notification permission is granted (the reminders switch asks for it), and removes it on logout. This needs a build with the push entitlement, which free Apple accounts can't sign, so `plugins/withoutPushEntitlement.js` strips it by default and registration quietly does nothing. With a paid account: add `expo.extra.eas.projectId` to `app.json` and prebuild with `ENABLE_PUSH=1 npx expo prebuild --platform ios`.
