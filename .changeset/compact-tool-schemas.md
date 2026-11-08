---
"@ngriffin_uk/polychat-library-tools": patch
"@assistant/api": patch
---

Tool definitions sent to models are about 7% smaller. `toToolInputJsonSchema` now drops JSON Schema noise from Zod output, such as safe-integer bounds, `false` and empty defaults, and duplicate union branches, and folds literal unions into a single `enum`. Inputs are still validated against the original Zod schema.
