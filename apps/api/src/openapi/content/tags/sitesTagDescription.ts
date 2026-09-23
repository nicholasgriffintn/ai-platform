import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const sitesTagDescription = md`
# Sites

Generate websites and application screens from one brief. Jev classifies the brief into a plan
(kind, scope, tone, palette and model tier), a coding model streams the site as JSON patch events
against a guardrailed component catalogue, and the result is kept as a revisioned output. Sites
export as a runnable Next.js project and can be handed to a project's sandbox for a full build.
`;
