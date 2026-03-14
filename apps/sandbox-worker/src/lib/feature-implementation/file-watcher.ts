import { parseSSEStream, type FileWatchSSEEvent } from "@cloudflare/sandbox";

import type { SandboxInstance } from "./types";
import type { TaskEvent } from "../../types";

export interface FileWatcher {
	stop(): void;
}

export function startFileWatcher(params: {
	sandbox: SandboxInstance;
	watchPath: string;
	emit: (event: TaskEvent) => Promise<void>;
	abortSignal?: AbortSignal;
}): FileWatcher {
	const { sandbox, watchPath, emit, abortSignal } = params;
	const controller = new AbortController();

	const run = async () => {
		try {
			const stream = await sandbox.watch(watchPath, {
				recursive: true,
			});

			for await (const event of parseSSEStream<FileWatchSSEEvent>(
				stream,
				controller.signal,
			)) {
				if (event.type === "event") {
					await emit({
						type: "file_changed",
						path: event.path,
						changeType: event.eventType,
						isDirectory: event.isDirectory,
					} as TaskEvent);
				}
			}
		} catch {
			// Watcher stopped or sandbox destroyed — expected during cleanup.
		}
	};

	run();

	abortSignal?.addEventListener("abort", () => controller.abort(), {
		once: true,
	});

	return {
		stop() {
			controller.abort();
		},
	};
}
