# Spend has three names instead of a number

- **Change:** Credits get three named bands, Everyday ask, Deep work and Big build, defined once in `packages/schemas`. Pricing shows the bands rather than an unlabelled ladder, and a task's plan evidence shows the running total across its attempts with the band it has reached, saying "so far" while a stage is still executing. Attempts that have not reported usage are excluded and called out rather than counted as zero.
- **Surfaces:** Web app and contracts. No API, database or migration change. Runner attribution and workspace spend reporting are untouched.
- **Prerequisites:** A task with at least one attempt that reported usage.
- **Risk if wrong:** A running total that understates spend by silently counting unreported attempts as zero.

## Verify

- [x] Open the pricing page. Confirm the three bands read sensibly against what a credit actually buys here, and that the ranges match the examples.
- [x] Run a short task. Confirm the plan evidence shows a running total and the Everyday ask band.
- [x] While a stage is still executing, confirm the total says "so far" rather than "in total".
- [x] Let it finish and confirm it says "in total" and matches the sum of the per-attempt figures already shown.
- [x] Run something long enough to pass 25 credits and confirm it is named a Big build.
- [x] Find a task with an attempt whose usage has not settled. Confirm the summary says some attempts have not reported, rather than quietly counting them as nothing.
- [x] Confirm a task with no reported usage shows no summary at all rather than zero credits.

**Stop and report if:** the running total disagrees with the per-attempt figures, or unreported attempts are counted as zero without saying so.

## Automated evidence — 7 September 2026

- `features/billing.spec.ts` opens the pricing page signed out and confirms the What a credit buys ladder lists exactly Everyday ask under 1 credit, Deep work 1-25 credits and Big build 25 credits and up, each with the example the band declares.
- The list now carries an accessible name so the ladder can be addressed rather than matched by its text.
- Whether those bands read sensibly against real spend is a judgement a person still has to make; the ranges and examples matching the contract is what the journey proves.
- Left open: every plan-evidence step. A running total, its so-far wording, the 25-credit crossing, unreported attempts and a task with no usage all need a real task with settled usage.

## Further automatic validation — 8 September 2026

- TaskCreditSummary now excludes null credit consumption instead of treating an empty usage record as reported zero. Five rendered-component cases cover absent usage, genuine zero, summed small attempts, missing attempts and the 25-credit boundary, including running/finished wording. All 18 workspace component tests passed. This validates controlled plan data, not live billed provider work.
