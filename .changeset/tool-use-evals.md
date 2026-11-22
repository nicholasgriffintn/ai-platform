---
"@assistant/api": minor
"@ngriffin_uk/polychat-library-model-registry": minor
"@ngriffin_uk/polychat-schemas": minor
---

Eval suites can now check how a model uses Polychat's tools, not just what it answers. Create a suite with `kind: "tool_use"`, or pass `builtIn: "tool_use_starter"` for a ready-made suite of 14 cases covering discovery, skills, asking the user, drafting versus sending, browser sign-in and delegation. Running it against a route replays each case with the real tool catalogue and system prompt while every tool result is canned, so nothing real runs, and grades the trajectory deterministically: which tools were called, with which arguments, in what order, and what was said. Each case is sampled twice, a third time when the two disagree, and the run stores every sample with its cost. Regrade a finished run after changing a case, without sampling again, and pass a baseline run to list the cases that used to pass and now fail. The grader is available as `@ngriffin_uk/polychat-library-model-registry/tool-use`.
