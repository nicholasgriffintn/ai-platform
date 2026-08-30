import type { GoalEvidenceEntry, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";

function comparableClaim(value: string): string {
  const normalised = value.trim().toLocaleLowerCase();
  let end = normalised.length;

  while (end > 0) {
    const character = normalised[end - 1];

    if (character !== "." && character !== "!" && character !== "?") {
      break;
    }

    end -= 1;
  }

  return normalised.slice(0, end);
}

export function isTaskCriterionMet(
  status: ProjectTaskStatus,
  criterion: string,
  evidence: readonly GoalEvidenceEntry[],
): boolean {
  if (status === "review" || status === "done") {
    return true;
  }

  const expectedClaim = comparableClaim(criterion);

  return evidence.some(
    (entry) => entry.status === "confirmed" && comparableClaim(entry.claim) === expectedClaim,
  );
}
