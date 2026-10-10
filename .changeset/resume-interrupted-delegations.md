---
"@assistant/api": minor
"@ngriffin_uk/polychat-schemas": minor
---

Resume delegations whose run was interrupted instead of failing them. Tool calls left without a result are settled first: reads may run again, anything else is reported as of unknown outcome so it is never repeated automatically. A delegation resumes at most twice, before its deadline, within the steps and credit it has left.
