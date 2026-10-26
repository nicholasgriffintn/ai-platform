import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";

interface TeamMember {
  teammateId: string;
  reportsToTeammateId: string | null;
  status: string;
}

export function breakdownHasTeammateApprover(
  task: Pick<ProjectTask, "owner">,
  team: readonly TeamMember[],
): boolean {
  if (task.owner?.type !== "teammate") {
    return false;
  }

  const ownerId = task.owner.id;
  const managerId = team.find((member) => member.teammateId === ownerId)?.reportsToTeammateId;

  return team.some(
    (member) =>
      member.teammateId === managerId &&
      member.teammateId !== ownerId &&
      member.status === "active",
  );
}
