# @ngriffin_uk/polychat-ai-billing

## 0.3.0

### Minor Changes

- 7accf45: Pull typed values out of text and images with Cloudflare's Clairic.

  - **Extraction models.** Clairic joins the catalogue as the first extraction model. Give it some text, or up to four images, and a list of named fields, and it returns each one as the type you asked for: a span of the text, a number, a date, a duration, a list, or an estimate or forecast with an 80% range. Anything the input does not say comes back empty with a best guess, never made up.
  - **`POST /extractions`.** Send `state`, `fields` and optional `images` and `reference_date`. Every scalar answer carries `confidence` and `p_null`, so you can decide in code which values to trust.
  - **Extract values tool.** Chat, Poly and automations can call `extract_values` to read order numbers, totals and dates from an email or invoice in one fast call, then hand the values to `decide`.
  - **Paperwork.** A new app for receipts, invoices and damage claims. Drop in photos or paste text, and each figure comes back with a confidence, the source highlighted where it was found, a running total and a CSV export.

- 7a9f872: Teammates and routines now show what they cost and can be given a monthly budget.

  - **Spend on the teammate page.** A teammate's card shows the credits its runs have used this month, and the working context has a Spend section with the same figure against its cap.
  - **Monthly caps.** Set a cap in credits on a teammate's working context or on a routine. Once the month's spend reaches it, new runs are refused with a note saying why, a routine over its cap pauses itself with the reason shown, and everything resumes when the month resets or you raise the cap.
  - **Runs remember their routine.** Each run records which routine started it, so routine spend is exact rather than estimated.

### Patch Changes

- Updated dependencies [8b2929f]
- Updated dependencies [8b965f6]
- Updated dependencies [91c7d3d]
- Updated dependencies [7accf45]
- Updated dependencies [bf39c94]
- Updated dependencies [b3e3ea2]
- Updated dependencies [f4841cd]
- Updated dependencies [80fee8e]
- Updated dependencies [8b965f6]
- Updated dependencies [0a57f73]
- Updated dependencies [11381a9]
- Updated dependencies [91c7d3d]
- Updated dependencies [7b36da1]
- Updated dependencies [80fee8e]
- Updated dependencies [7a9f872]
- Updated dependencies [7accf45]
  - @ngriffin_uk/polychat-schemas@1.5.0
  - @ngriffin_uk/polychat-utility-core@0.5.0
  - @ngriffin_uk/polychat-ai-models@0.3.0
  - @ngriffin_uk/polychat-utility-server@0.3.0
  - @ngriffin_uk/polychat-ai-telemetry@0.2.2

## 0.2.1

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [393652d]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-schemas@1.4.0
  - @ngriffin_uk/polychat-ai-telemetry@0.2.1
  - @ngriffin_uk/polychat-utility-server@0.2.1
  - @ngriffin_uk/polychat-ai-models@0.2.1

## 0.2.0

### Minor Changes

- ece96c4: Add the billing and telemetry primitives. `ai-billing` holds turn estimates, credit state, rate-card pricing, provider billable units, subscription entitlement, price drift detection, and the usage engine (ledger, credit admission, reservations, plan allowances, infrastructure and capability metering) behind a `UsageStore` contract the API implements over its repositories. `ai-telemetry` holds the logger, a `Telemetry` facade over Analytics Engine, PostHog, beacon and OTLP sinks, AI generation and training-example capture, and token usage helpers. The API takes its logger, metrics recorder and training-example capture from this package, and its `lib/` tree now holds only host infrastructure with every capability under `services/`.

### Patch Changes

- Updated dependencies [ece96c4]
- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [b105d00]
- Updated dependencies [251ac59]
- Updated dependencies [41bb6a8]
- Updated dependencies [67b52ed]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [169e2f5]
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [b105d00]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-ai-telemetry@0.2.0
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-ai-models@0.2.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
