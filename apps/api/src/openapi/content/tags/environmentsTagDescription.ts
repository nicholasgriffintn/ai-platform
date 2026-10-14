import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const environmentsTagDescription = md`
# Environments

The places work runs: sandbox runs, hosted browser sessions, teammate computers and paired machines. One id space covers them all; pass \`kind\` to skip resolution.

- \`POST /environments/{environment_id}/actions\` takes over, views, releases, pauses, resumes, cancels, stops or answers an approval, depending on what the environment supports.
- Sandboxes take instructions while running, keep an event log and can work toward a goal. Healthy declared services can be previewed through short-lived links.
- Machines take runs through \`POST /environments/{environment_id}/runs\`.
`;
