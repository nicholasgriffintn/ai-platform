const activeRuns = new Map<string, AbortController>();

export function registerDynamicWorkerRun(
	runId: string,
	controller: AbortController,
): void {
	activeRuns.set(runId, controller);
}

export function unregisterDynamicWorkerRun(runId: string): void {
	activeRuns.delete(runId);
}

export function cancelDynamicWorkerRun(runId: string): boolean {
	const controller = activeRuns.get(runId);
	if (!controller) {
		return false;
	}
	controller.abort("Cancelled by user request");
	activeRuns.delete(runId);
	return true;
}
