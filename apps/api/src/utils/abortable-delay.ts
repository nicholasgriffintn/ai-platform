export function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.reject(signal.reason ?? new Error("Operation aborted"));
	}

	return new Promise((resolve, reject) => {
		const handleAbort = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", handleAbort);
			reject(signal?.reason ?? new Error("Operation aborted"));
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", handleAbort);
			resolve();
		}, delayMs);
		signal?.addEventListener("abort", handleAbort, { once: true });
	});
}
