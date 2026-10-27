#!/usr/bin/env bash
# Builds the app for the simulator and then runs the end-to-end tests against that exact build.
# This is the way to build: a build is not finished until the flows pass.
#
#   npm run build:sim            (needs the native project: npx expo prebuild --platform ios --clean)
#
# Environment: SIMULATOR (device id, default: the booted one), DERIVED (build folder).
set -uo pipefail
cd "$(dirname "$0")/.."

export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"
DERIVED="${DERIVED:-/tmp/pt-derived}"
SIMULATOR="${SIMULATOR:-$(xcrun simctl list devices booted | grep -Eo '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1)}"
[ -n "$SIMULATOR" ] || { echo "build: no booted simulator" >&2; exit 2; }
[ -d ios/PetTracker.xcworkspace ] || { echo "build: no native project. Run: npx expo prebuild --platform ios --clean" >&2; exit 2; }

echo "build: compiling for the simulator ($SIMULATOR)"
(cd ios && xcodebuild -workspace PetTracker.xcworkspace -scheme PetTracker -configuration Debug \
  -destination "id=$SIMULATOR" -derivedDataPath "$DERIVED" build >/tmp/pt-build.log 2>&1)
if ! grep -q "BUILD SUCCEEDED" /tmp/pt-build.log; then
  echo "build: FAILED, see /tmp/pt-build.log" >&2
  grep -m5 "error:" /tmp/pt-build.log >&2
  exit 1
fi
echo "build: succeeded"

APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/PetTracker.app" exec bash e2e/run.sh
