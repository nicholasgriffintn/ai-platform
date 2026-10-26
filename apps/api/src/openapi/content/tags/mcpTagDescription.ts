import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const mcpTagDescription = md`
# MCP

Use Polychat as a Model Context Protocol server from clients such as Claude, ChatGPT and Codex. Point the client at \`/mcp\` over Streamable HTTP and authenticate with a Polychat API key.

- \`tools/list\` offers the tools you can run in Polychat, plus one tool per teammate.
- \`tools/call\` runs them under your authority. Anything that needs approval waits for you in Polychat.
- Polychat sends no server-initiated messages, so \`GET /mcp\` answers 405.
`;
