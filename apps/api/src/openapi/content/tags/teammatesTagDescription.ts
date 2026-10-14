import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const teammatesTagDescription = md`
# Teammates

Teammates are configured agents with their own instructions, model, tools, skills and MCP servers. A teammate works as a \`colleague\` or a \`bot\`.

## Create

Write one from scratch with \`POST /teammates\`, or hire one with \`POST /teammates/hire\` from a built-in role, a job description, or both.

~~~json
{
  "name": "Code reviewer",
  "kind": "colleague",
  "system_prompt": "Review code for security, performance and clarity. Be specific.",
  "temperature": 0.2,
  "enabled_tools": ["web_search"],
  "skill_ids": ["skill_123"]
}
~~~

\`servers\` attaches MCP servers through an existing credential connection, limited to \`allowedTools\`.

## Run

A teammate turn is a Response. Pass the teammate as the agent:

~~~json
{
  "agent": { "type": "teammate", "id": "teammate_123" },
  "input": "Review the open pull request",
  "stream": true
}
~~~

## Contexts and autonomy

A teammate works inside a scoped context, personal or project, with its own private memory. Each context has a status (\`active\`, \`paused\` or \`archived\`) and an autonomy level:

- \`observer\` only reads and drafts.
- \`assistant\` asks before writes.
- \`partner\` writes within its connection grants.

Sends, spending, deletes, credentials and exports always ask. Grant exact connection operations with \`PATCH /teammates/contexts/{context_id}/connections\`.

## Workspaces and the marketplace

- \`POST /teammates/{teammate_id}/publish\` copies a personal teammate into a workspace. \`workspace_default\` gives it to every project, and a project can opt out.
- \`POST /teammates/{teammate_id}/feedback\` records whether it got a conversation right, building its scorecard.
- \`/teammates/marketplace\` shares teammates publicly for others to install and rate. Admins moderate and feature listings.
`;
