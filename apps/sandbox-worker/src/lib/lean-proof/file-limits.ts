import { quoteForShell, type SandboxExecInstance } from "../commands";
import { resolveContainedRepositoryFile } from "./repository-path";

export const LEAN_PROOF_MAX_TARGET_FILE_BYTES = 1_000_000;
export const LEAN_PROOF_MAX_TARGET_BYTES = 4_000_000;

export interface LeanTargetFileSnapshot {
  path: string;
  resolvedPath: string;
  sizeBytes: number;
}

function parseFileSize(path: string, output: string): number {
  const value = output.trim();

  if (!/^\d+$/.test(value)) {
    throw new Error(`Failed to determine Lean target size: ${path}`);
  }

  const size = Number(value);

  if (!Number.isSafeInteger(size)) {
    throw new Error(`Failed to determine Lean target size: ${path}`);
  }

  return size;
}

function assertFileAndAggregateLimits(
  path: string,
  sizeBytes: number,
  aggregateBytes: number,
): void {
  if (sizeBytes > LEAN_PROOF_MAX_TARGET_FILE_BYTES) {
    throw new Error(
      `Lean target exceeds the ${LEAN_PROOF_MAX_TARGET_FILE_BYTES}-byte per-file limit: ${path}`,
    );
  }

  if (aggregateBytes > LEAN_PROOF_MAX_TARGET_BYTES) {
    throw new Error(`Lean targets exceed the ${LEAN_PROOF_MAX_TARGET_BYTES}-byte aggregate limit`);
  }
}

export async function assertLeanTargetFileLimits(params: {
  sandbox: SandboxExecInstance;
  repositoryRoot: string;
  targetPaths: readonly string[];
}): Promise<LeanTargetFileSnapshot[]> {
  const snapshots: LeanTargetFileSnapshot[] = [];
  let aggregateBytes = 0;

  for (const path of params.targetPaths) {
    const resolvedPath = await resolveContainedRepositoryFile(
      params.sandbox,
      params.repositoryRoot,
      path,
    );
    const stat = await params.sandbox.exec(`stat -Lc %s -- ${quoteForShell(resolvedPath)}`);

    if (!stat.success) {
      throw new Error(`Failed to determine Lean target size: ${path}`);
    }

    const sizeBytes = parseFileSize(path, stat.stdout);

    aggregateBytes += sizeBytes;
    assertFileAndAggregateLimits(path, sizeBytes, aggregateBytes);
    snapshots.push({ path, resolvedPath, sizeBytes });
  }

  return snapshots;
}

export function assertLeanReplacementFileLimits(
  snapshots: readonly LeanTargetFileSnapshot[],
  path: string,
  replacementSource: string,
): void {
  const target = snapshots.find((snapshot) => snapshot.path === path);

  if (!target) {
    throw new Error(`Lean target size was not checked: ${path}`);
  }

  const replacementBytes = new TextEncoder().encode(replacementSource).byteLength;
  const aggregateBytes = snapshots.reduce((total, snapshot) => total + snapshot.sizeBytes, 0);
  const replacementAggregateBytes = aggregateBytes - target.sizeBytes + replacementBytes;

  assertFileAndAggregateLimits(path, replacementBytes, replacementAggregateBytes);
}
