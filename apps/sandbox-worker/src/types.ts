import type {
	SandboxRunEvent,
	SandboxTaskResult,
	SandboxWorkerExecuteRequest,
} from "@assistant/schemas";

export type TaskParams = SandboxWorkerExecuteRequest;
export type TaskResult = SandboxTaskResult;
export type TaskEvent = SandboxRunEvent;
export type TaskEventEmitter = (event: TaskEvent) => Promise<void> | void;

export interface TaskSecrets {
	userToken: string;
	githubToken?: string;
}

export interface Env {
	Sandbox: DurableObjectNamespace<import("./index").Sandbox>;
	JWT_SECRET?: string;
}
