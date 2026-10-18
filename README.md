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
- **Last 7 days:** the Home screen ends with feedings and walks per day (bars, today emphasised, total and daily average), computed on the device from the loaded entries (`src/utils/insights.ts`) in the dog's timezone.
- **Staying signed in:** logins last 7 days on the server. The app swaps its token for a fresh one on every launch and when it returns to the foreground after 6 hours (`src/api/session.ts`, one request at a time), so regular use never signs out. A 401 anywhere signs out locally without calling the server. Profile has "Log out everywhere".
- **Face ID login:** after signing in once with the password, the app offers to use Face ID (or Touch ID; Profile > Security turns it on or off). The password is then kept in the iOS keychain behind the biometric check (`src/api/faceLogin.ts`, `expo-secure-store` with `requireAuthentication`), never in plain storage. When the 7-day login has expired, the login screen asks for Face ID by itself and signs in with the saved password; after choosing to log out it shows a Face ID button instead. A changed password clears the saved one. Needs a one-time native rebuild (`npx expo prebuild --platform ios --clean`).
- **Logging offline:** a feeding, walk, bath or weigh-in logged without a connection is kept on the phone (`src/api/outbox.ts`, wiped on logout), shown at once with a small cloud icon, and sent oldest first every 20 seconds, when the app comes forward, and on pull-to-refresh. A banner on each screen says how many are waiting (tap to try now). Each carries a random `client_id`, so one sent twice is saved once. Entries still waiting can be edited or deleted on the phone with no request. Editing or deleting already-saved entries still needs a connection. An entry the server rejects as invalid is dropped so it can't block the rest.
- **Who logged it:** on a dog with more than one owner, a row logged by a co-owner shows their first name next to the time (`src/utils/who.ts`). Your own entries are left plain, since most rows are yours and a label on each would hide the exception.
- **Care reminders:** vaccinations, vet visits and flea/tick/worm treatments with a next-due date get a local reminder a week before and on the day, at 09:00 (`src/utils/careReminders.ts`, rebuilt with the other reminders). A newer entry of the same thing replaces the older one's date (a renewed rabies shot, the next flea treatment), overdue and undated entries give nothing, and at most 20 are scheduled so the daily ones stay within iOS's 64-notification limit. They follow the same Profile > Reminders switch.
- **Export:** Profile > Export makes a one-page vet summary (PDF: dog facts, current weight, the last 15 weigh-ins, vaccinations, treatments and vet visits) or a CSV of all the health data, and opens the share sheet (Files, AirDrop, Mail). The PDF is printed from HTML (`src/utils/exportData.ts`, every user-written text escaped); the CSV is UTF-8 with a byte-order mark so Excel reads æøå, one `type,date,value,detail,next_due,notes` row per entry, with formula-looking cells (`=`, `+`, `-`, `@`) neutralised. Feedings and walks are not included. Uses `expo-print`, `expo-sharing` and `expo-file-system`, so it needs a one-time native rebuild (`npx expo prebuild --platform ios --clean`, then build). If the build fails to link with missing `facebook::react` symbols, delete `ios/Pods/React-Core-prebuilt` and `ios/Pods/ReactNativeDependencies` and run `pod install` again.
- **Daily goals:** each dog has a shared goal for feedings (default 1) and walks (default 2) per day, set in Profile. Home and the Mat/Tur screens show `count/goal` with a green check once it is reached, and "done for the day" now means the goal is reached: the feeding or walk reminder for today only goes away at that point, and today's reminder says how far along it is ("1 of 2 walks") when some are done.
- **Dog food:** Home > Hundemat sets up the current bag (size in half kilos, portion in tens of grams, opened today). The app works out how many days are left (`src/utils/food.ts`, in the dog's calendar days), shows it on Home (honey when 7 days or fewer remain, red when out), and reminds a week before it runs out and on the day, at 09:00. "Ny sekk i dag" starts the next bag. Shared by all owners; each phone schedules its own reminders.
- **Reminder rebuilds run one at a time** (`schedulingQueue` in `RemindersContext`). Several inputs change in a burst at start-up, and overlapping rebuilds used to stack duplicate copies of every reminder.
- **Home-screen widget:** a small and a medium widget ("I dag"/"Today") show today's feedings and walks as `count/goal` for the active dog, with a **+** button on each that logs a feeding or walk without opening the app (iOS 17). It is its own app extension in `targets/widget` (SwiftUI + App Intents, generated by `@bacons/apple-targets`; the app's minimum iOS is therefore 17). The app and the widget share an App Group (`group.com.benjaminliestol.pettracker`): the app writes a snapshot there (the dog, goals, the last three days of timestamps, the API address and the **current login token**, so the buttons can log), the widget counts "today" itself in the dog's timezone and restarts at midnight, and a log that can't be sent (no connection) is queued in the group for the app to send under the same id (no duplicates). The snapshot is removed on sign-out. The token in that storage is only readable by this app and its widget, but it is a plain login token, so treat the widget as the trade-off it is.
  - **Build:** `npx expo prebuild --platform ios --clean` (a plain re-run fails once the widget target exists), then build and add the widget from the home-screen gallery.
  - **If signing refuses the App Group** (a free Apple account may): `NO_WIDGET=1 npx expo prebuild --platform ios --clean` builds the app without the widget (`app.config.js`).
  - **Not included:** a Siri / Shortcuts-app "Log a walk" action. App Shortcuts have to live in the main app target, which this setup doesn't generate.
