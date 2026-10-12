import { sandboxDirectoryBackupSchema } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

import { startComputer, stopComputer } from "./browser";
import { PROFILE_DIRECTORY } from "./config";
import type { ComputerSandbox } from "./types";

export async function createComputerCheckpoint(
  sandbox: ComputerSandbox,
  resourceId: string,
): Promise<string> {
  await stopComputer(sandbox);

  try {
    const backup = await sandbox.backupDirectory({
      dir: PROFILE_DIRECTORY,
      name: `computer-${resourceId}`,
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
  const backup = sandboxDirectoryBackupSchema.safeParse(safeParseJson(reference));

  if (!backup.success) {
    throw new Error("The computer checkpoint is not a directory backup");
  }

  await sandbox.restoreDirectory(backup.data);
  await startComputer(sandbox);
}
