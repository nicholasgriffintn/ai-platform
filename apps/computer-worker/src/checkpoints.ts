import type { DirectoryBackup } from "@cloudflare/sandbox";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { startComputer, stopComputer } from "./browser";
import { PROFILE_DIRECTORY } from "./constants";
import type { ComputerSandbox } from "./types";

function parseCheckpointReference(value: string): DirectoryBackup {
  const parsed: unknown = JSON.parse(value);

  if (
    !isRecord(parsed) ||
    typeof parsed.id !== "string" ||
    !parsed.id ||
    typeof parsed.dir !== "string" ||
    !parsed.dir ||
    (parsed.localBucket !== undefined && typeof parsed.localBucket !== "boolean")
  ) {
    throw new Error("Checkpoint reference is invalid");
  }

  return {
    id: parsed.id,
    dir: parsed.dir,
    ...(typeof parsed.localBucket === "boolean" ? { localBucket: parsed.localBucket } : {}),
  };
}

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
  await sandbox.restoreBackup(parseCheckpointReference(reference));
  await startComputer(sandbox);
}
