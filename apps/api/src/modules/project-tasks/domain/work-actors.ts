import type { ProjectTask, WorkActor } from "@ngriffin_uk/polychat-schemas";

export function sameWorkActor(left: WorkActor, right: WorkActor): boolean {
  return left.type === "teammate"
    ? right.type === "teammate" && right.id === left.id
    : right.type === "person" && right.userId === left.userId;
}

export function taskReference(task: Pick<ProjectTask, "id" | "key">): string {
  return task.key ?? task.id;
}
