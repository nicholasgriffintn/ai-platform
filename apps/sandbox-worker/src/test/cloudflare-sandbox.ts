export class Sandbox {}

export class RPCTransportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RPCTransportError";
	}
}

export class SessionTerminatedError extends Error {
	constructor(public readonly exitCode: number | null = null) {
		super("Session terminated");
		this.name = "SessionTerminatedError";
	}
}

export function getSandbox(): never {
	throw new Error("Cloudflare Sandbox runtime is not available in unit tests");
}

export interface ExecEvent {
	type: "start" | "stdout" | "stderr" | "complete" | "error";
	timestamp: string;
	data?: string;
	exitCode?: number;
	result?: {
		success: boolean;
		exitCode: number;
		stdout: string;
		stderr: string;
		command?: string;
		duration?: number;
		timestamp?: string;
	};
	error?: string;
}

export interface FileWatchSSEEvent {
	type: "watching" | "event" | "error";
	path?: string;
	eventType?: string;
	isDirectory?: boolean;
}

export async function* parseSSEStream<T>(
	stream: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncIterable<T> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			if (signal?.aborted) {
				throw new DOMException("The operation was aborted", "AbortError");
			}

			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split("\n\n");
			buffer = parts.pop() ?? "";

			for (const part of parts) {
				const dataLine = part
					.split("\n")
					.find((line) => line.startsWith("data: "))
					?.slice("data: ".length);
				if (!dataLine) {
					continue;
				}
				yield JSON.parse(dataLine) as T;
			}
		}

		if (buffer.trim()) {
			const dataLine = buffer
				.split("\n")
				.find((line) => line.startsWith("data: "))
				?.slice("data: ".length);
			if (dataLine) {
				yield JSON.parse(dataLine) as T;
			}
		}
	} finally {
		reader.releaseLock();
	}
}
