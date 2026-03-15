import { md } from "~/utils/markdown.js";

export const appsTagDescription = md`
# Apps

Task-focused workflows such as research, summarization, creative generation, and automation that live under the \`/apps\` namespace.

## Overview

- **Auth required** — shared middleware enforces JWT authentication and plan entitlements.
- **Typed contracts** — request/response bodies align with schemas from \`@assistant/schemas\`.
- **Extensible** — new app modules mount as sub-routes (e.g. \`/apps/articles\`, \`/apps/notes\`, \`/apps/podcasts\`, \`/apps/sandbox\`) and inherit logging plus metrics.
- **Sandbox runs** — execution and lifecycle operations are exposed under \`/apps/sandbox/runs/*\`.
`;
