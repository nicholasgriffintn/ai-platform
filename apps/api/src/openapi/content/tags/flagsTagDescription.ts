import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const flagsTagDescription = md`
# Flags

Feature flag and experiment assignments for the calling user or anonymous session. Flagship and code rules are evaluated on the server, and clients resolve flags from \`GET /flags/bootstrap\` so they bucket the same way the API does.
`;
