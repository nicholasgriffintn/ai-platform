import { md } from "~/utils/markdown.js";

export const appsTagDescription = md`
# Apps

Task-focused workflows such as research, summarization, creative generation, and automation that live under the \`/apps\` namespace.

## Overview

- **Auth required** — shared middleware enforces JWT authentication and plan entitlements.
- **Typed contracts** — request/response bodies align with schemas from \`@assistant/schemas\`.
- **Extensible** — new app modules mount as sub-routes (e.g. \`/apps/articles\`, \`/apps/notes\`, \`/apps/podcasts\`) and inherit logging plus metrics.
- **Sandbox control** — sandbox connection and worker-control operations are exposed under \`/apps/sandbox/*\`; user-facing runs are started through normal chat tools.
`;
