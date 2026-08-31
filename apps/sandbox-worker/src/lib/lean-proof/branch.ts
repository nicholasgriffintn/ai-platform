export function buildLeanProofBranchName(runId: string): string {
  const safeRunId = runId.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64);

  return `polychat/lean-proof-${safeRunId}`;
}
