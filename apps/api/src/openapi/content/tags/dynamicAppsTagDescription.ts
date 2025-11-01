import { md } from "~/utils/markdown.js";

export const dynamicAppsTagDescription = md`# Dynamic Apps

Bring-your-own workflows compiled from stored schemas and executed at runtime.

Apps are auto-registered during worker boot via \`autoRegisterDynamicApps\`, and all routes inherit authentication plus logging middleware.`;
