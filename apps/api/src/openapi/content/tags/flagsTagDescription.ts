import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const flagsTagDescription = md`
# Flags

Feature flag and experiment assignments for the calling user or anonymous session. Clients seed their OpenFeature provider from \`GET /flags/bootstrap\` so they bucket the same way the API does.
`;
