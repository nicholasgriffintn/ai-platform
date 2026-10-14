import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const toolsTagDescription = md`
# Tools

The tools models and people can call.

- \`GET /tools\` lists the tools in the caller's scope, or a project's or workspace's. Pass them to \`POST /responses\` in \`tools\`.
- \`GET /tools/{tool_id}\` returns a form derived from the tool's input schema, and \`POST /tools/{tool_id}/execute\` runs it from the interface, storing the result as an output.
- \`PATCH /tools/{tool_id}/configuration\` validates and saves per-user configuration for a model tool.
- \`/tools/mcp_connections\` connects remote MCP servers, with a token or through an OAuth sign-in, and limits them to \`allowedTools\`.
`;
