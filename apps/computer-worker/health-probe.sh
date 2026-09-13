#!/usr/bin/env bash
set -uo pipefail

DISPLAY=:99 xdotool getmouselocation > /dev/null 2>&1 || exit 1
curl -s -m 5 http://127.0.0.1:9222/json/list 2> /dev/null | grep -q '"type"[[:space:]]*:[[:space:]]*"page"' || exit 1
DISPLAY=:99 scrot -o /tmp/computer-screen.png > /dev/null 2>&1 || exit 1
