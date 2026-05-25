#!/bin/sh
set -eu

action="${1:-}"
if [ -z "$action" ]; then
	echo "Usage: sh scripts/xcodebuild-mobile.sh <build|test|release>" >&2
	exit 64
fi

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
repo_root=$(CDPATH= cd "$script_dir/.." && pwd)
ios_dir="$repo_root/apps/mobile/ios"
scheme="Polychat"

find_simulator_id() {
	xcrun simctl list devices available \
		| sed -nE 's/^[[:space:]]*iPhone 16 \(([0-9A-F-]+)\).*/\1/p' \
		| head -n 1
}

find_fallback_simulator_id() {
	xcrun simctl list devices available \
		| sed -nE 's/^[[:space:]]*iPhone [^(]+ \(([0-9A-F-]+)\).*/\1/p' \
		| head -n 1
}

simulator_destination() {
	if [ -n "${IOS_SIMULATOR_DESTINATION:-}" ]; then
		echo "$IOS_SIMULATOR_DESTINATION"
		return
	fi

	simulator_id=$(find_simulator_id)
	if [ -z "$simulator_id" ]; then
		simulator_id=$(find_fallback_simulator_id)
	fi

	if [ -z "$simulator_id" ]; then
		echo "No available iPhone simulator found. Install an iOS Simulator runtime in Xcode." >&2
		exit 70
	fi

	echo "id=$simulator_id"
}

cd "$ios_dir"

case "$action" in
	build)
		xcodebuild -scheme "$scheme" -destination "$(simulator_destination)" build
		;;
	test)
		xcodebuild test -scheme "$scheme" -destination "$(simulator_destination)"
		;;
	release)
		xcodebuild -scheme "$scheme" -configuration Release build
		;;
	*)
		echo "Unknown mobile action: $action" >&2
		exit 64
		;;
esac
