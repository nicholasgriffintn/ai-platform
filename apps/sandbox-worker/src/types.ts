export interface TaskParams {
	userId: number;
	taskType: "feature-implementation" | "code-review";
	repo: string;
	task: string;
	model?: string;
	userToken: string;
	shouldCommit?: boolean;
	polychatApiUrl: string;
	githubToken?: string;
}

export interface TaskResult {
	success: boolean;
	logs: string;
	diff?: string;
	summary?: string;
	error?: string;
	branchName?: string;
}

export interface Env {
	Sandbox: DurableObjectNamespace<import("./index").Sandbox>;
}
