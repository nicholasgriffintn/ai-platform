import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const accountTagDescription = md`
# Account

Settings, exports, API keys and provider credentials for the signed-in person.

- \`PATCH /account\` updates account settings. \`GET /account/export\` downloads chat history as JSON.
- \`/api_keys\` creates long-lived keys for server-to-server use. The plaintext key is returned once; only its metadata is kept.
- \`/providers\` stores your own provider keys. \`POST /providers/sync\` adds any configurable provider you do not have yet.
`;
