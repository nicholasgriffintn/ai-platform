#!/usr/bin/env python3
"""Open a URL in the container Chromium and wait until it has painted.

Single entry point so one sandbox exec covers open, tab cleanup, load wait
and paint wait. Prints a JSON summary on success. Standard library only.
"""

import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:9222"
TITLE_TIMEOUT_SECONDS = 25
PAINT_TIMEOUT_SECONDS = 15
PAINT_BRIGHTNESS_THRESHOLD = 6.0


def api(path, method="GET", timeout=8):
    request = urllib.request.Request(BASE + path, method=method)

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode())


def targets():
    try:
        listed = api("/json/list")
    except Exception:
        return []

    return [target for target in listed if isinstance(target, dict)]


def wait_for_title(target_id):
    stable = None
    stable_count = 0
    start = time.time()

    while time.time() - start < TITLE_TIMEOUT_SECONDS:
        title = next(
            (str(target.get("title", "")).strip() for target in targets() if target.get("id") == target_id),
            "",
        )

        if title and title == stable:
            stable_count += 1

            if stable_count >= 3 and time.time() - start >= 2:
                return title
        else:
            stable = title or None
            stable_count = 1 if title else 0

        time.sleep(0.5)

    return stable or ""


def paint_score():
    env = dict(os.environ, DISPLAY=":99")
    captured = subprocess.run(
        ["scrot", "-o", "/tmp/computer-screen.png"],
        env=env,
        capture_output=True,
    )

    if captured.returncode != 0:
        return None

    scored = subprocess.run(
        ["python3", "/usr/local/bin/check-paint", "/tmp/computer-screen.png"],
        capture_output=True,
        text=True,
    )

    try:
        return float(scored.stdout.strip())
    except ValueError:
        return None


def wait_for_paint():
    start = time.time()

    while time.time() - start < PAINT_TIMEOUT_SECONDS:
        score = paint_score()

        if score is not None and score >= PAINT_BRIGHTNESS_THRESHOLD:
            return score

        time.sleep(0.5)

    return paint_score()


def main():
    url = sys.argv[1]
    created = api("/json/new?" + urllib.parse.quote(url, safe=""), "PUT")
    target_id = created["id"]

    for target in targets():
        if target.get("type") == "page" and target.get("id") != target_id:
            try:
                api("/json/close/" + target["id"])
            except Exception:
                pass

    title = wait_for_title(target_id)
    score = wait_for_paint()

    print(json.dumps({"targetId": target_id, "title": title, "paintScore": score}))


if __name__ == "__main__":
    main()
