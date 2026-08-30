import type { GoalEvidenceEntry, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";

function comparableClaim(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?]+$/, "");
}

export function isTaskCriterionMet(
  status: ProjectTaskStatus,
  criterion: string,
  evidence: readonly GoalEvidenceEntry[],
): boolean {
  if (status === "done") {
    return true;
  }

  const expectedClaim = comparableClaim(criterion);

  return evidence.some(
    (entry) => entry.status === "confirmed" && comparableClaim(entry.claim) === expectedClaim,
  );
}
