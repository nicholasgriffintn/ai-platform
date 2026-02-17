interface ActiveSandboxRun {
	abortController: AbortController;
}

const activeSandboxRuns = new Map<string, ActiveSandboxRun>();

export function registerActiveSandboxRun(
	runId: string,
	abortController: AbortController,
): () => void {
	activeSandboxRuns.set(runId, {
		abortController,
	});

	return () => {
		const current = activeSandboxRuns.get(runId);
		if (!current || current.abortController !== abortController) {
			return;
		}
		activeSandboxRuns.delete(runId);
	};
}

export function cancelActiveSandboxRun(runId: string): boolean {
	const activeRun = activeSandboxRuns.get(runId);
	if (!activeRun) {
		return false;
	}

	activeRun.abortController.abort();
	return true;
}
