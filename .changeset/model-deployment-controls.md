---
"@assistant/api": patch
"@assistant/mobile": patch
"@ngriffin_uk/polychat-ai-model-providers": patch
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-component-shell": patch
---

Require budget checks and approval for deployment resumes and scale increases. Wait for provider provisioning and deletion to finish before marking dedicated deployments deleted, and expose unsupported pause controls in host capabilities.

Claim the paid continuation after a Together upload so concurrent polls cannot create duplicate endpoints. Preserve uncertain continuation outcomes for reconciliation.

Preserve input withdrawals on completed training outputs and check current route approval for Chat and custom evaluation judges. Pass validation data to embedding training and run GGUF conversion with checked argument lists.
