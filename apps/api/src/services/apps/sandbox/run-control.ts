interface ActiveSandboxRun {
	abortController: AbortController;
}

const activeSandboxRuns = new Map<string, ActiveSandboxRun>();

export type SandboxRunAbortType = "cancelled" | "timeout" | "system";

export interface SandboxRunAbortReason {
	type: SandboxRunAbortType;
	message: string;
}

const DEFAULT_ABORT_MESSAGES: Record<SandboxRunAbortType, string> = {
	cancelled: "Run cancelled by user",
	timeout: "Sandbox run timed out",
	system: "Sandbox run stopped unexpectedly",
};

function normaliseAbortReason(
	reason: Partial<SandboxRunAbortReason> | undefined,
): SandboxRunAbortReason {
	const type: SandboxRunAbortType = reason?.type ?? "system";
	const fallback = DEFAULT_ABORT_MESSAGES[type];
	const message = reason?.message?.trim() || fallback;
	return { type, message };
}

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

export function abortActiveSandboxRun(
	runId: string,
	reason?: Partial<SandboxRunAbortReason>,
): boolean {
	const activeRun = activeSandboxRuns.get(runId);
	if (!activeRun) {
		return false;
	}

	activeRun.abortController.abort(normaliseAbortReason(reason));
	return true;
}

export function cancelActiveSandboxRun(runId: string): boolean {
	return abortActiveSandboxRun(runId, {
		type: "cancelled",
		message: DEFAULT_ABORT_MESSAGES.cancelled,
	});
}

export function getSandboxRunAbortReason(
	signal: AbortSignal,
): SandboxRunAbortReason | null {
	if (!signal.aborted) {
		return null;
	}

	const reason = signal.reason;
	if (
		reason &&
		typeof reason === "object" &&
		"type" in reason &&
		"message" in reason &&
		typeof (reason as { type?: unknown }).type === "string" &&
		typeof (reason as { message?: unknown }).message === "string"
	) {
		return normaliseAbortReason(reason as Partial<SandboxRunAbortReason>);
	}

	if (reason instanceof Error) {
		return normaliseAbortReason({
			type: "system",
			message: reason.message,
		});
	}

	return normaliseAbortReason(undefined);
}
