---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-client": patch
---

Queueing a follow-up message now accepts an `idempotency_key`, so a retried request returns the message it already queued instead of sending it twice. Cancelling a response and acting on an approval are safer too: cleanup after a cancel is no longer repeated or lost when a request is retried or interrupted, and an approved action only runs while the session that accepted it is still live.
