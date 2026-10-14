import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const skillsTagDescription = md`
# Skills

Reusable instructions teammates load when they are relevant.

- \`GET /skills\` lists every skill and whether it is ready in your own conversations. \`PATCH /skills/{skill_id}\` turns one on or off; always-on skills cannot be changed.
- Authored skills are revisioned documents. Save a draft without activating it, promote it, or roll back through a new immutable revision.
- Teach a skill by demonstration: a recorded teaching session becomes a disabled draft.

Project skills are managed through project capabilities.
`;
