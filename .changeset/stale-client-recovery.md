---
"@assistant/app": patch
---

Keep long-lived tabs current. Builds now publish `version.json` with their build id, and an open tab checks it when it becomes visible and every half hour, offering a refresh when a newer build is live. A chunk that fails to load after a deploy reloads the page once, with a cooldown so a broken build cannot loop, and a waiting service worker now offers the same refresh instead of only logging.
