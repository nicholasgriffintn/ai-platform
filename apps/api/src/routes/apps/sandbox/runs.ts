import type { Hono } from "hono";

import { registerSandboxRunLifecycleRoutes } from "./runs-lifecycle";

export function registerSandboxRunRoutes(app: Hono): void {
	registerSandboxRunLifecycleRoutes(app);
}
