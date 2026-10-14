import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const approvalsTagDescription = md`
# Approvals

Actions waiting on you before they run: connector operations, task questions and task tool approvals.

- \`PATCH /approvals/{approval_id}\` approves or rejects a connector operation. Task questions and tool approvals are answered through \`POST /responses/{response_id}/input\`.
- Standing approvals let Poly repeat one write to one destination without asking, for thirty days. Delete one to stop it.
`;
