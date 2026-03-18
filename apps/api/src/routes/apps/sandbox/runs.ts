import type { Hono } from "hono";

import { registerSandboxRunExecutionRoutes } from "./runs-execution";
import { registerSandboxRunLifecycleRoutes } from "./runs-lifecycle";

export function registerSandboxRunRoutes(app: Hono): void {
	registerSandboxRunLifecycleRoutes(app);
	registerSandboxRunExecutionRoutes(app);
}
