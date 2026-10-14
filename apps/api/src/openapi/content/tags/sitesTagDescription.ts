import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const sitesTagDescription = md`
# Sites

Generate websites and application screens from one brief. Jev classifies the brief into a plan
(kind, scope, tone, palette and model tier), a coding model streams the site as JSON patch events
against a guardrailed component catalogue, and the result is kept as a revisioned output.

- \`PATCH /sites/{site_id}\` applies inspector edits without a model. \`POST /sites/{site_id}/verify\` checks a revision in desktop and mobile browsers.
- \`POST /sites/{site_id}/images\` fills empty image slots from their alt text.
- Sites export as a runnable React Router, Next.js or TanStack Router project, open as a pull request on a connected repository, or hand off to a project's sandbox for a full build.
- Saved records and connector data give a site live content. Enable them per revision with \`/runtime\`.
`;
