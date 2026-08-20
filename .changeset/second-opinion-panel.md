---
"@assistant/api": minor
"@ngriffin_uk/polychat-library-chat": major
"@ngriffin_uk/polychat-component-conversation": major
"@ngriffin_uk/polychat-component-content": major
"@ngriffin_uk/polychat-component-models": major
---

Second opinions run as a panel. A `second-opinion` skill holds the method and a `second_opinion` tool runs it over `runPanel`, with each reviewer answering on its own model and reading what earlier reviewers said.

The client no longer builds the review prompt, detects the intent with a regex, or carries the request through message data. The message action sends a plain request and the model chooses the reviewers. `buildOpinionRequestPrompt`, `canRequestOpinionForMessage`, `getOpinionSourceContext`, `OpinionModelPicker` and the `renderOpinionSelector` prop are removed; `CouncilTurnView` becomes `PanelTurnView`, which both panels render through.
