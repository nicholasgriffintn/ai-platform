import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const a2aTagDescription = md`
# A2A

Talk to your teammates from agents that speak the Agent2Agent protocol. Authenticate with a Polychat API key; only the teammate's owner can reach it.

- \`GET /a2a/teammates/{teammate_id}/.well-known/agent-card.json\` describes the teammate.
- \`POST /a2a/teammates/{teammate_id}/rpc\` takes JSON-RPC. Each task is a Polychat Response in the teammate's own conversation: \`message/send\` starts or follows one up, \`message/stream\` streams it, and \`tasks/get\` and \`tasks/cancel\` read and stop it.
- Runs use the key owner's authority and wait on them in Polychat for approvals.
`;
