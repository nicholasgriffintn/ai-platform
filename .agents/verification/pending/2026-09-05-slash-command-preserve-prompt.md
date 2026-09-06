# Preserve drafted text when selecting a slash command

- **Change:** Limit slash-command replacement to the query and active word so selecting a command preserves the prompt after it.
- **Surfaces:** Shared web composer in personal Chat and project Work.
- **Prerequisites:** None.
- **Risk if wrong:** Selecting a command deletes drafted text or leaves part of the command behind.

## Verify

- [ ] Type `/hacker-news what's the latest, greatest news?`, move the caret back into `/hacker-news`, then select the suggestion. Confirm the skill becomes a chip and the full question remains.
- [ ] Repeat using keyboard selection and in a project conversation where the skill is available.
- [ ] Remove the selected skill chip and confirm the question remains editable.
- [ ] Select a model submenu option with prompt text after the caret and confirm the model changes while the following text remains.

**Stop and report if:** Selecting or removing a command deletes the drafted question.
