import { md } from "~/utils/markdown.js";

export const toolsTagDescription = md`# Tools

Catalog of server-registered tool definitions used by chat completions and agents.

Fetch the catalog before constructing tool-enabled prompts so the client can surface permitted capabilities and pass the right definitions to the chat API.`;
