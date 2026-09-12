#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:99

mkdir -p /workspace/profile /tmp/computer
Xvfb :99 -screen 0 1440x900x24 -nolisten tcp > /tmp/computer/xvfb.log 2>&1 &
openbox > /tmp/computer/openbox.log 2>&1 &
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 > /tmp/computer/x11vnc.log 2>&1 &
chromium --no-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-default-browser-check --user-data-dir=/workspace/profile about:blank > /tmp/computer/chromium.log 2>&1 &
exec websockify --web=/usr/share/novnc 6080 localhost:5900
