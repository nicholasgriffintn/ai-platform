# Maintain the model catalogue

Duplicating full configurations across providers hides exceptions and leaves descriptions incomplete. Keep shared expectations in family and model definitions, and keep execution differences in provider offerings.

## Edit the owning layer

Use `apps/api/src/data-model/models/`:

- **Family:** `families/<family>.json` owns the family description, shared defaults and a `models` map.
- **Model:** each entry in the family's `models` map owns the model description and defaults across providers. Provider offerings reference it as `<family>/<model>`.
- **Provider:** `providers/<provider>.json` owns provider defaults and offerings keyed by their existing local model IDs. Each offering references a shared model and retains its `matchingModel`, final `overrides` and optional `unset` fields.
- **Ordering:** `providers/index.json` preserves catalogue precedence when providers expose the same local ID. Keep this order stable to retain public IDs.
- **Imports:** the root `index.ts` file contains generated imports only. Regenerate it with the sync command after adding or removing definitions.

Encode reserved filename characters with `~HH` escapes through the sync tooling, including `~7E` for a literal tilde. Keep percent escapes out of generated paths: names such as `%2F` break file URL resolution in coverage and module tooling. Retain the original family IDs inside catalogue references.

Resolve **family defaults → model defaults → provider defaults → offering overrides**, then remove fields listed in `unset`. Replace arrays and nested objects as complete values; do not merge reasoning effort lists, modality lists or hosted-tool prices piecemeal. Use `false`, `0` and empty arrays as explicit values, and remove an `unset` entry before restoring that field.

Use the family description when a model has no narrower description. Keep provider-specific prices, API operations, hosted tools, enablement and lifecycle on the provider surface. Shared defaults do not grant platform or BYOK execution authority.

## Sync and reproduce

Build the shared schemas before running the tooling. Run the existing Node 24 project toolchain from the repository root:

```sh
pnpm --filter @ngriffin_uk/polychat-schemas build
pnpm --filter @assistant/api models:sync
pnpm --filter @assistant/api models:sync --write --save-snapshot /tmp/models-dev.json
pnpm --filter @assistant/api models:sync --snapshot /tmp/models-dev.json
```

The command defaults to a dry run. Use `--provider <id>` to restrict upstream updates, and `--models-dir <directory>` to inspect generated output separately. A saved snapshot disables all network access, including cached Artificial Analysis reads. Live sync reads cached analysis only when `POLYCHAT_API_KEY` is configured; it never launches an analysis task or spends model credits.

The sync imports [models.dev](https://models.dev/) descriptions and family metadata, resolves existing configuration, applies upstream updates and compacts the result back into shared defaults and explicit exceptions. Upstream fields remain sync-owned; preserve durable corrections in the sync rules. Keep Anthropic's sampling restrictions in `model-values.mjs` and direct OpenAI contract corrections in `model-contract-overrides.mjs`. Fields not supplied upstream, including custom API operations, hosted tools, pricing tiers and reasoning API settings, survive conversion.

Infer a shared model from its family and normalised upstream display name. Retain distinct names and variants rather than fuzzy-matching model identifiers. Prefer upstream descriptions, retain existing descriptions when upstream has none, and generate a factual capability summary only when neither exists. Family descriptions use repeated model descriptions where possible, then a summary of recorded output modalities.

To replay the full conversion, retain the original source tree's `data-model/models/` and `lib/providers/models/index.ts` together, then run:

```sh
pnpm --filter @assistant/api models:sync --convert-from /tmp/original-src --snapshot /tmp/models-dev.json --models-dir /tmp/converted-models --write
```

Use only trusted original TypeScript sources for this explicit migration command. The converter evaluates their constants, spreads and constructors, preserves provider ordering, and compares every resolved offering with its source before writing. Only descriptions, family metadata and missing display names may change during conversion; prices, reasoning, capabilities and execution settings must match. This importer is migration tooling; the application and normal sync consume only the new catalogue.

Repeat a command with identical input and expect `changedFiles: 0`. Validate the API typecheck and `scripts/sync-models-dev` tests after edits. Generated catalogue files remain excluded from lint and formatting; validate their schema, references and generated imports instead.
