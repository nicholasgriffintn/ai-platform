import type { TaskEvent } from "../types";
import {
  execOrThrow,
  execOrThrowRedacted,
  quoteForShell,
  type SandboxExecInstance,
} from "./commands";

export async function pushBranchToRemote(params: {
  sandbox: SandboxExecInstance;
  repoTargetDir: string;
  branchName: string;
  remoteBranchName?: string;
  checkoutAuthHeader?: string;
  executionLogs: string[];
  checkpoint: (abortMessage: string) => Promise<void>;
  emit: (event: TaskEvent) => Promise<void>;
}): Promise<void> {
  const {
    sandbox,
    repoTargetDir,
    branchName,
    remoteBranchName = branchName,
    checkoutAuthHeader,
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

  if (checkoutAuthHeader) {
    await execOrThrowRedacted(
      sandbox,
      `git -c http.extraHeader=${quoteForShell(checkoutAuthHeader)} -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(refspec)}`,
      executionLogs,
      `git -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(refspec)} [auth header redacted]`,
    );
  } else {
    await execOrThrow(
      sandbox,
      `git -C ${quoteForShell(repoTargetDir)} push --set-upstream origin ${quoteForShell(refspec)}`,
      executionLogs,
    );
  }

  await checkpoint("Sandbox run cancelled after push");
  await emit({
    type: "commit_pushed",
    branchName: remoteBranchName,
  });
}
