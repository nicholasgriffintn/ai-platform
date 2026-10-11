---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-component-shell": minor
---

Start a recipe from any service with a private webhook URL. Each webhook can carry an "only run when" condition, can be paused, rotated or deleted, and honours an Idempotency-Key header so retries do not run twice. Payloads reach the recipe as untrusted data and never carry authority. Composio and webhook events now share one admission path.
