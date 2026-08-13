export function finaliseReadableStream<T>(params: {
	stream: ReadableStream<T>;
	cleanup?: () => Promise<void>;
	onError?: (error: unknown, controller: ReadableStreamDefaultController<T>) => void;
}): ReadableStream<T> {
	const reader = params.stream.getReader();
	let cleanupPromise: Promise<void> | undefined;
	const cleanOnce = () => (cleanupPromise ??= params.cleanup?.() ?? Promise.resolve());

	return new ReadableStream<T>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					await cleanOnce();
					controller.close();
					return;
				}
				controller.enqueue(value);
			} catch (error) {
				try {
					params.onError?.(error, controller);
				} finally {
					await cleanOnce();
					controller.close();
				}
			}
		},
		async cancel(reason) {
			try {
				await reader.cancel(reason);
			} finally {
				await cleanOnce();
			}
		},
	});
}
