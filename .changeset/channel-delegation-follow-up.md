---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
---

When a teammate started from a Slack, Telegram or email thread hands work to a delegate, the follow-up it writes once that work reports back is now sent to the same thread. The sender mapping and binding are rechecked before sending, and each follow-up is delivered at most once.
