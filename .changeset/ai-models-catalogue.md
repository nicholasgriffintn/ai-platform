---
"@ngriffin_uk/polychat-ai-models": minor
"@ngriffin_uk/polychat-library-model-catalogue": minor
"@assistant/api": patch
---

Move the model catalogue and model policy out of the API. `library-model-catalogue` owns the models.dev data, its schema and the sync script, and `ai-models` owns lookups, tier and lineup resolution, credential authority, reasoning and verbosity rules. The API loads models from these packages and the `sync-models-dev` workflow runs from the catalogue package.
