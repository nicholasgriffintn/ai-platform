# `@ngriffin_uk/polychat-library-surface`

Host controls used by reusable Polychat React rendering. Render packages inspect an action's
availability and invoke it without depending on React Router, browser globals, or native-shell
implementation details.

Applications provide concrete adapters. Missing capabilities fail closed with a typed error and
an explicit user-facing reason.
