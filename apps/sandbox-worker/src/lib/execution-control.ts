import type { TaskEventEmitter } from "../types";
import { SandboxCancellationError, throwIfAborted } from "./cancellation";
import { RunControlClient } from "./run-control-client";

const PAUSE_POLL_INTERVAL_MS = 2000;
const PAUSE_HEARTBEAT_INTERVAL_MS = 30000;

export class SandboxTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SandboxTimeoutError";
	}
}

interface CreateExecutionControlOptions {
	runId?: string;
	timeoutSeconds?: number;
	polychatApiUrl: string;
	userToken: string;
	abortSignal?: AbortSignal;
	emitEvent?: TaskEventEmitter;
}

export interface ExecutionControl {
	checkpoint: (abortMessage: string) => Promise<void>;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function createExecutionControl(
	options: CreateExecutionControlOptions,
): ExecutionControl {
	const {
		runId,
		timeoutSeconds,
		polychatApiUrl,
		userToken,
		abortSignal,
		emitEvent,
	} = options;

	const timeoutMs =
		typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds)
			? timeoutSeconds * 1000
			: undefined;
	const deadlineMs =
		typeof timeoutMs === "number" ? Date.now() + timeoutMs : undefined;

	const runControlClient = runId
		? new RunControlClient({
				polychatApiUrl,
				userToken,
				runId,
			})
		: null;

	const throwIfTimedOut = () => {
		if (deadlineMs === undefined) {
			return;
		}

		if (Date.now() <= deadlineMs) {
			return;
		}

		const seconds = Math.max(1, Math.floor((timeoutMs ?? 1000) / 1000));
		throw new SandboxTimeoutError(
			`Sandbox run timed out after ${seconds} seconds`,
		);
	};

	const waitWhilePaused = async (pauseReason?: string) => {
		if (!runControlClient) {
			return;
		}

		await emitEvent?.({
			type: "run_paused",
			runId,
			message: pauseReason || "Run paused by user request",
		});
		let lastHeartbeatAt = Date.now();

		while (true) {
			throwIfAborted(abortSignal, "Sandbox run cancelled while paused");
			throwIfTimedOut();

			await wait(PAUSE_POLL_INTERVAL_MS);
			const nextControlState =
				await runControlClient.fetchControlState(abortSignal);

			if (!nextControlState) {
				continue;
			}

			if (nextControlState.state === "cancelled") {
				throw new SandboxCancellationError(
					nextControlState.cancellationReason ||
						"Sandbox run cancelled while paused",
				);
			}

			if (nextControlState.state === "paused") {
				if (Date.now() - lastHeartbeatAt >= PAUSE_HEARTBEAT_INTERVAL_MS) {
					lastHeartbeatAt = Date.now();
					await emitEvent?.({
						type: "run_paused",
						runId,
						message: nextControlState.pauseReason || "Run is still paused",
					});
				}
				continue;
			}

			await emitEvent?.({
				type: "run_resumed",
				runId,
				message: "Run resumed",
			});
			return;
		}
	};

	return {
		checkpoint: async (abortMessage: string) => {
			throwIfAborted(abortSignal, abortMessage);
			throwIfTimedOut();

			if (!runControlClient) {
				return;
			}

			const controlState =
				await runControlClient.fetchControlState(abortSignal);
			if (!controlState) {
				return;
			}

			if (controlState.state === "cancelled") {
				throw new SandboxCancellationError(
					controlState.cancellationReason || "Sandbox run cancelled",
				);
			}

			if (controlState.state === "paused") {
				await waitWhilePaused(controlState.pauseReason);
			}
		},
	};
}
