import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const memoryTagDescription = md`
# Memory

Memory is a set of revisioned documents: personal, project-scoped, or private to one teammate context.

- Every save creates a revision you can list.
- Corrections are rules teammates record after you correct them. Forgetting one removes it from the list but leaves any text it already changed.
- Syntheses consolidate a memory namespace in the background. Queue one, then read the active synthesis.
`;
