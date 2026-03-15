import type { Hono } from "hono";

import { registerSandboxRunApprovalRoutes } from "./runs-approvals";
import { registerSandboxRunExecutionRoutes } from "./runs-execution";
import { registerSandboxRunLifecycleRoutes } from "./runs-lifecycle";

export function registerSandboxRunRoutes(app: Hono): void {
	registerSandboxRunLifecycleRoutes(app);
	registerSandboxRunApprovalRoutes(app);
	registerSandboxRunExecutionRoutes(app);
}
