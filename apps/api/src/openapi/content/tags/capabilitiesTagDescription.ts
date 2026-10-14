import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const capabilitiesTagDescription = md`
# Capabilities

The teammates, experiences, model tools and skills a project or a person can enable.

\`GET /capabilities\` is filtered by the caller's plan and access. \`GET /capabilities/catalogue\` is the unfiltered public catalogue of built-in experiences, tools and recipe templates. Function tools are published, and run, by \`/tools\`.
`;
