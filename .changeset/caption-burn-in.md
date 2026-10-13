---
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": minor
"@assistant/sandbox-worker": minor
---

Add a `caption_video` tool that transcribes an uploaded video with timings and returns a copy with captions burned in. Encoding runs once per request in an isolated computer container, which now ships ffmpeg and Noto Sans.
