import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const outputsTagDescription = md`
# Outputs

What Polychat produces and keeps: documents, files, images and tool results. Outputs are personal or project-scoped, and every save is a revision.

- \`PATCH /outputs/{output_id}\` saves a new revision. Earlier revisions can be restored.
- Share links are revocable and readable without signing in at \`/outputs/shared/{token}\`.
- Council reviews have four seats critique the current revision and vote. An adjudicator returns ship, revise or hold with a revision brief.

Routes that only apply to documents are listed under Documents.
`;
