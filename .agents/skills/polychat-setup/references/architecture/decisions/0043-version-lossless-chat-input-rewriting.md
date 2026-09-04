# ADR 0043: Version chat input rewriting by scope

**Status:** Accepted. Extends ADR 0017.

Verbose JSON tool results waste context. Compact JSON whitespace by default at the shared chat provider boundary while preserving values, protocol fields, and stored history.

Store personal and project overrides in `capability_configuration` under `chat_input_policy/default`. Let users and project administrators disable rewriting, preview changes, and restore saved settings. Compare revisions on save and retain the last 20 revisions.

Use project policy independently of personal settings. This chat transform does not implement the provider execution governance described in ADR 0040.
