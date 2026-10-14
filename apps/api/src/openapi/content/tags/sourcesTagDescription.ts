import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const sourcesTagDescription = md`
# Sources

Source material for retrieval, personal or project-scoped. Group sources into collections, search a project's knowledge, and keep connector content fresh with knowledge syncs you can pause, resume or refresh.

\`PATCH /sources/project_context\` sets which sources form a project's standing context.
`;
