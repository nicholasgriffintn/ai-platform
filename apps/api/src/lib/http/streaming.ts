import { NO_STORE } from "@assistant/schemas";

export const SSE_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": NO_STORE,
	Connection: "keep-alive",
} as const;

export function sseResponse(stream: ReadableStream): Response {
	return new Response(stream, { headers: SSE_HEADERS });
}
