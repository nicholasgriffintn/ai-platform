import {
	execOrThrow,
	execOrThrowRedacted,
	quoteForShell,
	type SandboxExecInstance,
} from "./commands";
import type { TaskEvent } from "../types";

export async function pushBranchToRemote(params: {
	sandbox: SandboxExecInstance;
	repoTargetDir: string;
	branchName: string;
	checkoutAuthHeader?: string;
	executionLogs: string[];
	checkpoint: (abortMessage: string) => Promise<void>;
	emit: (event: TaskEvent) => Promise<void>;
}): Promise<void> {
	const {
		sandbox,
		repoTargetDir,
		branchName,
		checkoutAuthHeader,
		executionLogs,
		checkpoint,
		emit,
	} = params;

	await checkpoint("Sandbox run cancelled before push");
	await emit({
		type: "commit_push_started",
		branchName,
	});

	if (checkoutAuthHeader) {
		await execOrThrowRedacted(
			sandbox,
			`git -c http.extraHeader=${quoteForShell(checkoutAuthHeader)} -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(branchName)}`,
			executionLogs,
			`git -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(branchName)} [auth header redacted]`,
		);
	} else {
		await execOrThrow(
			sandbox,
			`git -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(branchName)}`,
			executionLogs,
		);
	}

	await checkpoint("Sandbox run cancelled after push");
	await emit({
		type: "commit_pushed",
		branchName,
	});
}
