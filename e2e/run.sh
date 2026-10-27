#!/usr/bin/env bash
# End-to-end tests: drives the real app in the iOS Simulator against the real (local) backend
# with Maestro. Run it after every build:   npm run e2e
#
# It creates a throwaway account and dog through the API, runs the flows, and always deletes
# them again. It needs: a booted simulator with the app installed, the backend reachable (Herd),
# Maestro and Java (brew install openjdk@17 mobile-dev-inc/tap/maestro).
set -uo pipefail
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.maestro/bin:$PATH"
BACKEND_DIR="${BACKEND_DIR:-../pet-tracker-backend}"
BUNDLE_ID="com.benjaminliestol.pettracker"
APP_PATH="${APP_PATH:-/tmp/pt-derived/Build/Products/Debug-iphonesimulator/PetTracker.app}"

# A throwaway local test account (never a real person's).
export E2E_EMAIL="e2e-test@example.test"
export E2E_PASSWORD="e2e-pass-1234"
DOG_NAME="E2E Dog"

fail() { echo "e2e: $*" >&2; exit 2; }

command -v maestro >/dev/null || fail "Maestro is not installed (brew install openjdk@17 mobile-dev-inc/tap/maestro)"
java -version >/dev/null 2>&1 || fail "Java is not available (brew install openjdk@17)"
xcrun simctl list devices booted | grep -q Booted || fail "No booted simulator"
[ -d "$BACKEND_DIR" ] || fail "Backend folder not found: $BACKEND_DIR (set BACKEND_DIR)"

# API address: the one the app uses, found the way Expo does (most specific file first).
API_ROOT=""
for f in .env.development.local .env.local .env.development .env; do
  [ -f "$f" ] || continue
  API_ROOT="$(grep -E '^EXPO_PUBLIC_API_URL=' "$f" | head -1 | cut -d= -f2- | tr -d '"')"
  [ -n "$API_ROOT" ] && break
done
API="${API_ROOT:-https://pet-tracker-backend.test/api}/v1"
H=(-H "Accept: application/json" -H "Content-Type: application/json")

cleanup_backend() {
  (cd "$BACKEND_DIR" && php artisan tinker --execute='
    $u = \App\Models\User::withTrashed()->where("email", "'"$E2E_EMAIL"'")->first();
    if ($u) {
      foreach ($u->pets()->withTrashed()->get() as $p) { $p->forceDelete(); }
      $u->tokens()->delete();
      $u->forceDelete();
    }
    \App\Models\Pet::withTrashed()->where("name", "'"$DOG_NAME"'")->forceDelete();' >/dev/null 2>&1)
}

STARTED_METRO=""
finish() {
  code=$?
  cleanup_backend
  [ -n "$STARTED_METRO" ] && kill "$STARTED_METRO" 2>/dev/null
  exit $code
}
trap finish EXIT

# The app is a debug build: it loads its JavaScript from Metro.
if ! curl -s -o /dev/null http://localhost:8081/status; then
  echo "e2e: starting Metro"
  nohup npx expo start --port 8081 >/tmp/e2e-metro.log 2>&1 &
  STARTED_METRO=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:8081/status && break; sleep 2; done
  curl -s -o /dev/null http://localhost:8081/status || fail "Metro did not start (see /tmp/e2e-metro.log)"
fi

# Test data: start clean, then make the account and a dog (defaults: 1 feeding, 2 walks a day).
cleanup_backend
code=$(curl -sk -o /tmp/e2e-register.json -w "%{http_code}" "${H[@]}" -X POST "$API/auth/register" \
  -d "{\"first_name\":\"E2E\",\"last_name\":\"Test\",\"email\":\"$E2E_EMAIL\",\"password\":\"$E2E_PASSWORD\"}")
[ "$code" = "201" ] || fail "Could not create the test account (HTTP $code). Is the backend running at $API ?"
TOKEN="$(python3 -c 'import json;print(json.load(open("/tmp/e2e-register.json"))["token"])')"
rm -f /tmp/e2e-register.json
code=$(curl -sk -o /dev/null -w "%{http_code}" "${H[@]}" -H "Authorization: Bearer $TOKEN" -X POST "$API/pets" \
  -d "{\"name\":\"$DOG_NAME\",\"timezone\":\"Europe/Oslo\"}")
[ "$code" = "201" ] || fail "Could not create the test dog (HTTP $code)"

# Install the build under test, if there is one.
if [ -d "$APP_PATH" ]; then
  xcrun simctl terminate booted "$BUNDLE_ID" >/dev/null 2>&1
  xcrun simctl install booted "$APP_PATH" || fail "Could not install $APP_PATH"
else
  xcrun simctl get_app_container booted "$BUNDLE_ID" >/dev/null 2>&1 || fail "The app is not installed on the simulator and $APP_PATH does not exist"
  echo "e2e: using the app that is already installed (no build at $APP_PATH)"
fi

echo "e2e: running the flows"
maestro test e2e -e E2E_EMAIL="$E2E_EMAIL" -e E2E_PASSWORD="$E2E_PASSWORD" "$@"
