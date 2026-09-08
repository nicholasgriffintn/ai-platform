# Models page reads as one page and provider marks resolve aliases

- **Change:** `/models` now has one header ("Every model, one perch") with a section navigation, followed by Tiers, On your own hardware, System models, Behind the scenes and By provider as sibling sections. Provider glyphs resolve aliased provider IDs (for example `google-ai-studio`, `perplexity-ai`, `the-grid-ai`, `standardcompute`) to the same artwork the model icon uses, and the Standard Compute mark follows the theme's text colour.
- **Surfaces:** Web `/models`, the Discover models band, and every provider glyph in the web app.
- **Prerequisites:** None.
- **Risk if wrong:** Provider chips or headings could fall back to a single letter, a monochrome mark could vanish on a dark palette, or a section link could land under the header.
- **Commits:** None yet.

## Verify

- [x] Open `/models` signed out. Confirm a single page heading, the section chips, and that each chip scrolls to its section with the heading clear of the header.
- [x] In the "By provider" filter and section headings, confirm Google AI Studio, Perplexity AI, The Grid AI, Standard Compute, Azure OpenAI and GitHub Models show artwork rather than an initial.
- [ ] Switch between Light, Paper, Dawn, Dark, Blue, Fern and Plum from the sidebar settings. Confirm every provider mark stays visible in each palette, including Standard Compute and The Grid AI.
- [ ] Open `/discover` and confirm the models band shows the same artwork for those providers.

**Stop and report if:** a provider in the filter shows a letter while its models show artwork, or a mark disappears on any palette.

## Automated evidence — 7 September 2026

- New local Chromium `features/models-page.spec.ts` opens `/models` signed out, confirms the single `Every model, one perch` page heading, the five section chips, and follows each one to its heading in the viewport.
- Every provider in the By provider filter and its matching section renders registered artwork or the explicit initial fallback consistently, so no provider is marked one way in the filter and another in its section.
- The shell chrome title is now a non-heading label, so the page has one level-one heading; the focused regression journey passed after this fix.
- Left open: the per-palette check across Light, Paper, Dawn, Dark, Blue, Fern and Plum, and the Discover models band.
