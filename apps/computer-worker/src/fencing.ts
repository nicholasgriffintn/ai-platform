import { stopScreenServer } from "./browser";
import { FENCE_FILE } from "./constants";
import type { ComputerSandbox } from "./types";

export async function readFence(sandbox: ComputerSandbox): Promise<number> {
  const currentFile = await sandbox.readFile(FENCE_FILE, { encoding: "utf-8" }).catch(() => null);
  const current = currentFile ? Number.parseInt(currentFile.content, 10) : 0;

  return Number.isFinite(current) ? current : 0;
}

export async function assertFence(
  sandbox: ComputerSandbox,
  fence: number | undefined,
): Promise<void> {
  if (typeof fence !== "number" || !Number.isSafeInteger(fence) || fence <= 0) {
    throw new Error("A valid lease fence is required");
  }

  const current = await readFence(sandbox);

  if (Number.isFinite(current) && fence < current) {
    throw new Error("The computer lease is stale");
  }

  if (!Number.isFinite(current) || fence > current) {
    await sandbox.writeFile(FENCE_FILE, String(fence));
  }
}

export async function revokeComputerControl(
  sandbox: ComputerSandbox,
  fence: number | undefined,
): Promise<void> {
  if (typeof fence !== "number" || !Number.isSafeInteger(fence) || fence <= 0) {
    throw new Error("A valid lease fence is required");
  }

  const current = await readFence(sandbox);

  if (current !== fence + 1) {
    await assertFence(sandbox, fence);
    await sandbox.writeFile(FENCE_FILE, String(fence + 1));
  }

  await stopScreenServer(sandbox);
}
