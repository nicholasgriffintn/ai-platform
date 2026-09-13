import { FENCE_FILE } from "./constants";
import type { ComputerSandbox } from "./types";

export async function readFence(sandbox: ComputerSandbox): Promise<number> {
  const result = await sandbox.exec(`cat ${FENCE_FILE} 2>/dev/null || echo 0`).catch(() => null);
  const current = result && result.success ? Number.parseInt(result.stdout.trim(), 10) : Number.NaN;

  return Number.isFinite(current) ? current : 0;
}

async function ensureFenceDirectory(sandbox: ComputerSandbox): Promise<void> {
  await sandbox.exec("mkdir -p /workspace").catch(() => null);
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
    await ensureFenceDirectory(sandbox);
    await sandbox.writeFile(FENCE_FILE, String(fence));
  }
}

export async function ensureInitialisedFence(sandbox: ComputerSandbox): Promise<number> {
  const current = await readFence(sandbox);

  if (current >= 1) {
    return current;
  }

  await ensureFenceDirectory(sandbox);
  await sandbox.writeFile(FENCE_FILE, "1");

  return 1;
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
    await ensureFenceDirectory(sandbox);
    await sandbox.writeFile(FENCE_FILE, String(fence + 1));
  }
}
