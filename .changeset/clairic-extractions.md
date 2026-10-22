---
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-ai-models": minor
"@ngriffin_uk/polychat-ai-providers": minor
"@ngriffin_uk/polychat-ai-functions": minor
"@ngriffin_uk/polychat-ai-billing": minor
"@ngriffin_uk/polychat-library-model-catalogue": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-utility-core": minor
"@ngriffin_uk/polychat-component-models": patch
"@ngriffin_uk/polychat-component-shell": minor
"@assistant/api": minor
---

Pull typed values out of text and images with Cloudflare's Clairic.

- **Extraction models.** Clairic joins the catalogue as the first extraction model. Give it some text, or up to four images, and a list of named fields, and it returns each one as the type you asked for: a span of the text, a number, a date, a duration, a list, or an estimate or forecast with an 80% range. Anything the input does not say comes back empty with a best guess, never made up.
- **`POST /extractions`.** Send `state`, `fields` and optional `images` and `reference_date`. Every scalar answer carries `confidence` and `p_null`, so you can decide in code which values to trust.
- **Extract values tool.** Chat, Poly and automations can call `extract_values` to read order numbers, totals and dates from an email or invoice in one fast call, then hand the values to `decide`.
- **Paperwork.** A new app for receipts, invoices and damage claims. Drop in photos or paste text, and each figure comes back with a confidence, the source highlighted where it was found, a running total and a CSV export.
