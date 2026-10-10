import type { TaskEvent } from "../../../types";
import { execOrThrow, quoteForShell, type SandboxExecInstance } from "./commands";

export async function pushBranchToRemote(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  branchName: string;
  remoteBranchName?: string;
  executionLogs: string[];
  checkpoint: (abortMessage: string) => Promise<void>;
  emit: (event: TaskEvent) => Promise<void>;
}): Promise<void> {
  const {
    sandbox,
    repoTargetDir,
    branchName,
    remoteBranchName = branchName,
    executionLogs,
    checkpoint,
    emit,
  } = params;

  await checkpoint("Sandbox run cancelled before push");
  await emit({
    type: "commit_push_started",
    branchName: remoteBranchName,
  });

  const refspec =
    remoteBranchName === branchName ? branchName : `${branchName}:refs/heads/${remoteBranchName}`;

  await execOrThrow(
    sandbox,
    `git -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(refspec)}`,
    executionLogs,
  );

  await checkpoint("Sandbox run cancelled after push");
  await emit({
    type: "commit_pushed",
    branchName: remoteBranchName,
  });
}
