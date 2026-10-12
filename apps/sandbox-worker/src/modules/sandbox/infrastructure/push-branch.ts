import { quoteShellArgument } from "@ngriffin_uk/polychat-utility-core";

import type { TaskEvent } from "../../../types";
import { execOrThrow, type SandboxExecInstance } from "./commands";

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
    `git -C ${quoteShellArgument(repoTargetDir)} push --set-upstream origin ${quoteShellArgument(refspec)}`,
    executionLogs,
  );

  await checkpoint("Sandbox run cancelled after push");
  await emit({
    type: "commit_pushed",
    branchName: remoteBranchName,
  });
}
