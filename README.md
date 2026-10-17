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

## Behaviour worth knowing

- **Auth:** bearer token in SecureStore; any 401 (except on login/register) logs the user out. Signing out wipes the cached pet and care data.
- **Offline:** pet data and care records are cached per pet and shown immediately while the network refreshes. Reads are retried once; writes never are, so a slow save can't create duplicates. Requests time out after 15 seconds.
- **Long histories:** feedings and walks load 100 entries and fetch the next 100 as you scroll. Weights load up to 500 for the chart.
- **Reminders:** local notifications only (feeding, walk, weekly weigh-in); no server push.
