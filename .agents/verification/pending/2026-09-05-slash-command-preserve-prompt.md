# Preserve drafted text when selecting a slash command

- **Change:** Limit slash-command replacement to the query and active word so selecting a command preserves the prompt after it.
- **Surfaces:** Shared web composer in personal Chat and project Work.
- **Prerequisites:** None.
- **Risk if wrong:** Selecting a command deletes drafted text or leaves part of the command behind.

## Verify

- [x] Type `/hacker-news what's the latest, greatest news?`, move the caret back into `/hacker-news`, then select the suggestion. Confirm the skill becomes a chip and the full question remains.
- [x] Repeat using keyboard selection and in a project conversation where the skill is available.
- [x] Remove the selected skill chip and confirm the question remains editable.
- [x] Select a model submenu option with prompt text after the caret and confirm the model changes while the following text remains.

**Stop and report if:** Selecting or removing a command deletes the drafted question.

## Automated evidence — 5 September 2026

Run `features/composer-drafts.spec.ts`: all three local Chromium journeys passed against the real API, including enabling Hacker News in the project. The model submenu journey exposed a misplaced cursor before the separating space when a draft followed the command. The shared replacement helper now places the cursor after that space; the browser journey and all 18 composer parser tests pass.
