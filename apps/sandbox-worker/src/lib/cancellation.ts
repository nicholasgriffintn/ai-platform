const DEFAULT_CANCELLED_MESSAGE = "Sandbox run cancelled";

export class SandboxCancellationError extends Error {
	constructor(message = DEFAULT_CANCELLED_MESSAGE) {
		super(message);
		this.name = "SandboxCancellationError";
	}
}

export function throwIfAborted(signal?: AbortSignal, message?: string): void {
	if (!signal?.aborted) {
		return;
	}

	throw new SandboxCancellationError(message);
}
