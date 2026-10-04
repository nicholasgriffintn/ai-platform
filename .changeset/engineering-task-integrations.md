---
"@assistant/api": minor
"@assistant/app": minor
"@assistant/desktop": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-client": minor
"@ngriffin_uk/polychat-library-react": minor
"@ngriffin_uk/polychat-schemas": minor
"@ngriffin_uk/polychat-utility-server": patch
---

Import GitHub and Linear issues into Work with approved task plans and immutable source snapshots. Reuse existing imports and reject issues changed since preview.

Review exact GitHub PR revisions manually or through an opted-in, signed webhook policy. Run captured diffs through the existing Work runner with a fixed tool scope, current authority and token budgets, then retain the result as a governed Output.

Preview and approve GitHub publication separately. Refuse stale targets and other accounts' connections, publish once against the captured commit, and reconcile lost responses without repeating the write. PR comment commands use the commit-bound Work review path.

Apply migration `0058_project_task_integrations` before deployment. Automatic intake requires a webhook secret and pull-request events; publication requires pull-request write permission. Reviews cover captured patches and report omitted context; they do not execute repository code.
