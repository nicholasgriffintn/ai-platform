import { md } from "~/utils/markdown.js";

export const userTagDescription = md`
# User

Manage per-user preferences, provider credentials, API keys, and exports.

All routes require authentication and return typed envelopes defined in \`@assistant/schemas\` for consistent client handling.
`;
