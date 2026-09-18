import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const toolsTagDescription = md`
# Tools

Catalog of server-registered tool definitions used by chat completions and agents.

Fetch the catalog before constructing tool-enabled prompts so the client can surface permitted capabilities and pass the right definitions to the chat API.
`;
