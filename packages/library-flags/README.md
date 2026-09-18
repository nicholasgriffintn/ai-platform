# @ngriffin_uk/polychat-library-flags

Feature flag mechanisms with the OpenFeature vocabulary and no OpenFeature dependency. A `FlagProvider` resolves a key against an `EvaluationContext` (a `targetingKey` plus attributes) into `ResolutionDetails` with a `value`, `variant`, `reason` and optional `errorCode`, the same shape the spec and Cloudflare Flagship return.

## Providers

- `createRulesProvider(lookup)` evaluates code-defined `FlagRule`s: `enabled` gates the rule (`DISABLED`), `target` forces a variant (`TARGETING_MATCH`), `split` buckets the targeting key across weighted variants (`SPLIT`), and a rule with no split is `STATIC`. A split without a targeting key returns the default with `TARGETING_KEY_MISSING` rather than a random bucket.
- `createFlagshipProvider(binding)` adapts a `Flagship` Workers binding (the `flagship` wrangler binding) to the same contract, keeping only primitive context attributes and mapping its reasons and error codes.
- `createLayeredProvider([dashboard, rules])` returns the first resolution that is not a default or an error, so a dashboard can pause, force or ramp a code-defined experiment without a second definition.

## Bucketing

`bucketFor(targetingKey, salt)` hashes the key with SHA-256 into a stable number in `[0, 1)`; `pickWeighted(bucket, entries)` maps it onto cumulative weights. Different flags use their key as the salt, so one user lands in independent buckets per experiment.
