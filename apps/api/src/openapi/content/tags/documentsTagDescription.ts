import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const documentsTagDescription = md`
# Documents

Editing and review for document outputs. These routes live under \`/outputs/{output_id}\` and apply only to documents.

- Comment on a selection, then resolve or reopen the thread.
- Propose an edit to a selection, then apply it.
- Rewrite formatting without changing what it says, keep a generated description on it, or export it as Markdown.
`;
