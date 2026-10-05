import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { ProjectFlowWait, WorkspaceRole } from "@ngriffin_uk/polychat-schemas";

export function canReviewProjectFlowWait(
  userId: number,
  role: WorkspaceRole,
  wait: ProjectFlowWait | null,
): boolean {
  if (!wait || wait.kind !== "human") {
    return false;
  }

  const assignedUserId =
    typeof wait.payload.assignedUserId === "number"
      ? wait.payload.assignedUserId
      : wait.assignedUserId;

  return authorise("task.flow.respond", {
    actorId: String(userId),
    assigneeId: assignedUserId === null ? "" : String(assignedUserId),
    member: true,
    role,
  }).allowed;
}
