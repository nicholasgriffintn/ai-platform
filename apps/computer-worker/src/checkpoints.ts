import { parseSandboxCheckpointReference } from "@ngriffin_uk/polychat-library-sandbox";

import { startComputer, stopComputer } from "./browser";
import { PROFILE_DIRECTORY } from "./config/app";
import type { ComputerSandbox } from "./types";

export async function createComputerCheckpoint(
  sandbox: ComputerSandbox,
  resourceId: string,
): Promise<string> {
  await stopComputer(sandbox);

  try {
    const backup = await sandbox.createBackup({
      dir: PROFILE_DIRECTORY,
      name: `computer-${resourceId}`,
      ttl: 30 * 24 * 60 * 60,
      gitignore: false,
    });

    return JSON.stringify(backup);
  } finally {
    await startComputer(sandbox);
  }
}

export async function restoreComputerCheckpoint(
  sandbox: ComputerSandbox,
  reference: string,
): Promise<void> {
  await stopComputer(sandbox);
  await sandbox.restoreBackup(parseSandboxCheckpointReference(reference));
  await startComputer(sandbox);
}
