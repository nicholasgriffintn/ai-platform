---
"@assistant/api": minor
"@ngriffin_uk/polychat-library-model-registry": minor
"@ngriffin_uk/polychat-schemas": minor
---

Admins can now check how a model uses Polychat's tools, not just what it answers. `pnpm --filter @assistant/api evals:tool-use run --model <id>` replays tool-use cases against the real tool catalogue and system prompt with canned tool results, so nothing real runs, and grades each trajectory deterministically: which tools were called, with which arguments, in what order, and what was said. Each case is sampled twice, a third time when the two disagree, and results are saved with their cost. `regrade` re-scores saved results after a case or grader changes without sampling again, and `--baseline` with `--stop-on-regression` stops on the first case that used to pass. The grader is available as `@ngriffin_uk/polychat-library-model-registry/tool-use`.
