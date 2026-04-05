export const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	Connection: "keep-alive",
} as const;

const encoder = new TextEncoder();

export function toSseChunk(value: unknown): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
}

export function doneSseChunk(): Uint8Array {
	return encoder.encode("data: [DONE]\n\n");
}

export function isStreamRequest(request: Request): boolean {
	return request.headers.get("accept")?.includes("text/event-stream") ?? false;
}

export function createJsonResponse(
	status: number,
	payload: Record<string, unknown>,
): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export function getBearerToken(request: Request): string {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return "";
	}
	return authHeader.slice("Bearer ".length).trim();
}
