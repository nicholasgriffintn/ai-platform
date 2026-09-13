#!/usr/bin/env bash
set -euo pipefail

export DISPLAY=:99

mkdir -p /workspace/profile /tmp/computer /tmp/.X11-unix
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
CHROME_BIN="$(command -v google-chrome-stable || command -v google-chrome || command -v chromium || command -v chromium-browser)"
Xvfb :99 -screen 0 1440x900x24 -nolisten tcp > /tmp/computer/xvfb.log 2>&1 &
for _ in $(seq 1 50); do
  if DISPLAY=:99 xdotool getmouselocation > /dev/null 2>&1; then
    break
  fi
  sleep 0.2
done
openbox > /tmp/computer/openbox.log 2>&1 &
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 > /tmp/computer/x11vnc.log 2>&1 &
"$CHROME_BIN" --no-sandbox --disable-dev-shm-usage --disable-gpu --no-first-run --no-default-browser-check --window-size=1440,900 --window-position=0,0 --force-device-scale-factor=1 --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir=/workspace/profile about:blank > /tmp/computer/chromium.log 2>&1 &
exec websockify --web=/usr/share/novnc 6080 localhost:5900
