import type { Hono } from "hono";

import { registerDynamicWorkerRunExecutionRoutes } from "./runs-execution";
import { registerDynamicWorkerRunLifecycleRoutes } from "./runs-lifecycle";

export function registerDynamicWorkerRunRoutes(app: Hono): void {
	registerDynamicWorkerRunLifecycleRoutes(app);
	registerDynamicWorkerRunExecutionRoutes(app);
}
