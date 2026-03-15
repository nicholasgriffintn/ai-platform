export const SANDBOX_SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
} as const;

interface EventEnvelopeLike {
	index: number;
	event: {
		type: string;
	};
}

interface CreateCoordinatorEventStreamParams {
	listEvents: (after: number) => Promise<EventEnvelopeLike[]>;
	openSocket?: () => Promise<WebSocket | null>;
	initialAfter?: number;
	signal?: AbortSignal;
	pollIntervalMs?: number;
	heartbeatIntervalMs?: number;
}

export function isTerminalSandboxEventType(type: string): boolean {
	return (
		type === "run_completed" ||
		type === "run_failed" ||
		type === "run_cancelled"
	);
}

export function toSseChunk(value: unknown): Uint8Array {
	return new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);
}

export function toSsePingChunk(): Uint8Array {
	return new TextEncoder().encode(": ping\n\n");
}

export function toSseDoneChunk(): Uint8Array {
	return new TextEncoder().encode("data: [DONE]\n\n");
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEnvelopeFromSocketMessage(
	data: unknown,
): EventEnvelopeLike | null {
	if (typeof data !== "string") {
		return null;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(data) as Record<string, unknown>;
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object") {
		return null;
	}
	const value = parsed as Record<string, unknown>;
	if (
		typeof value.index !== "number" ||
		!Number.isFinite(value.index) ||
		!value.event ||
		typeof value.event !== "object" ||
		typeof (value.event as { type?: unknown }).type !== "string"
	) {
		return null;
	}

	return {
		index: value.index,
		event: value.event as EventEnvelopeLike["event"],
	};
}

async function consumeSocketEvents(params: {
	socket: WebSocket;
	controller: ReadableStreamDefaultController<Uint8Array>;
	signal?: AbortSignal;
	heartbeatIntervalMs: number;
	onEnvelope: (envelope: EventEnvelopeLike) => void;
}): Promise<{ terminalSeen: boolean; aborted: boolean }> {
	const { socket, controller, signal, heartbeatIntervalMs, onEnvelope } =
		params;
	let terminalSeen = false;
	let aborted = false;

	await new Promise<void>((resolve) => {
		let settled = false;
		const done = () => {
			if (settled) {
				return;
			}
			settled = true;
			clearInterval(heartbeatTimer);
			socket.removeEventListener("message", onMessage as EventListener);
			socket.removeEventListener("close", onClose as EventListener);
			socket.removeEventListener("error", onError as EventListener);
			signal?.removeEventListener("abort", onAbort);
			resolve();
		};

		const onMessage = (event: MessageEvent) => {
			const envelope = parseEnvelopeFromSocketMessage(event.data);
			if (!envelope) {
				return;
			}
			onEnvelope(envelope);
			controller.enqueue(toSseChunk(envelope.event));
			if (isTerminalSandboxEventType(envelope.event.type)) {
				terminalSeen = true;
				done();
			}
		};

		const onClose = () => done();
		const onError = () => done();
		const onAbort = () => {
			aborted = true;
			done();
		};

		const heartbeatTimer = setInterval(() => {
			controller.enqueue(toSsePingChunk());
		}, heartbeatIntervalMs);

		socket.addEventListener("message", onMessage as EventListener);
		socket.addEventListener("close", onClose as EventListener);
		socket.addEventListener("error", onError as EventListener);
		signal?.addEventListener("abort", onAbort);
	});

	try {
		socket.close(1000, "SSE stream detached");
	} catch {
		// Ignore websocket close errors.
	}

	return { terminalSeen, aborted };
}

export function createCoordinatorEventSseStream(
	params: CreateCoordinatorEventStreamParams,
): ReadableStream<Uint8Array> {
	const {
		listEvents,
		openSocket,
		initialAfter = 0,
		signal,
		pollIntervalMs = 900,
		heartbeatIntervalMs = 15000,
	} = params;

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			let after = initialAfter;
			let terminalSeen = false;
			let aborted = false;
			let lastHeartbeatAt = Date.now();

			const applyEnvelope = (envelope: EventEnvelopeLike) => {
				after = Math.max(after, envelope.index);
			};

			if (openSocket && !signal?.aborted) {
				try {
					const socket = await openSocket();
					if (socket) {
						const socketState = await consumeSocketEvents({
							socket,
							controller,
							signal,
							heartbeatIntervalMs,
							onEnvelope: applyEnvelope,
						});
						terminalSeen = socketState.terminalSeen;
						aborted = socketState.aborted;
					}
				} catch {
					// Fallback to polling if websocket setup fails.
				}
			}

			while (!terminalSeen && !aborted && !signal?.aborted) {
				const envelopes = await listEvents(after);
				if (envelopes.length === 0) {
					if (Date.now() - lastHeartbeatAt >= heartbeatIntervalMs) {
						lastHeartbeatAt = Date.now();
						controller.enqueue(toSsePingChunk());
					}
					await sleep(pollIntervalMs);
					continue;
				}

				for (const envelope of envelopes) {
					applyEnvelope(envelope);
					controller.enqueue(toSseChunk(envelope.event));
					if (isTerminalSandboxEventType(envelope.event.type)) {
						terminalSeen = true;
						break;
					}
				}
			}

			controller.enqueue(toSseDoneChunk());
			controller.close();
		},
		cancel() {
			// Run continues in background; stream cancellation only detaches client.
		},
	});
}
