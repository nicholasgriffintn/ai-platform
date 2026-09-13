#!/usr/bin/env bash
# Wait until the Chromium remote debugger reports a page target.
set -uo pipefail

for _ in $(seq 1 30); do
  if curl -s -m 2 http://127.0.0.1:9222/json/list 2> /dev/null | grep -q '"type"[[:space:]]*:[[:space:]]*"page"'; then
    exit 0
  fi

  sleep 0.5
done

exit 1
