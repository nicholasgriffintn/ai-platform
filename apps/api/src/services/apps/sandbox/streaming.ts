export const SANDBOX_SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
} as const;

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
