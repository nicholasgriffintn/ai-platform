import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const modelServingTagDescription = md`
# Model serving

Put model versions behind stable names.

- Deployments run a version on a provider. Plan one first, then scale it, try it in the playground or act on it.
- Aliases point a name at a version. Promote and roll back move the pointer.
- Routes expose models to callers, each with a health check. A version can suggest routes for itself.
`;
