import type { WorkActor } from "@ngriffin_uk/polychat-schemas";

export interface WorkPersonSummary {
  userId: number;
  name: string | null;
}

export interface WorkTeammateSummary {
  id: string;
  name: string;
  assignable: boolean;
}

export interface WorkDirectory {
  people: readonly WorkPersonSummary[];
  teammates: readonly WorkTeammateSummary[];
}

export function describeWorkActor(actor: WorkActor | null, directory: WorkDirectory): string {
  if (!actor) {
    return "Unassigned";
  }

  if (actor.type === "teammate") {
    return directory.teammates.find((teammate) => teammate.id === actor.id)?.name ?? "Teammate";
  }

  return directory.people.find((person) => person.userId === actor.userId)?.name ?? "Person";
}

export function encodeWorkActor(actor: WorkActor | null): string {
  if (!actor) {
    return "none";
  }

  return actor.type === "teammate" ? `teammate:${actor.id}` : `person:${actor.userId}`;
}

export function decodeWorkActor(value: string): WorkActor | null {
  const [type, id] = value.split(":", 2);

  if (type === "teammate" && id) {
    return { type: "teammate", id };
  }

  const userId = Number(id);

  return type === "person" && Number.isInteger(userId) && userId > 0
    ? { type: "person", userId }
    : null;
}

export function workActorOptions(
  directory: WorkDirectory,
  noneLabel = "Unassigned",
): { value: string; label: string }[] {
  return [
    { value: "none", label: noneLabel },
    ...directory.teammates
      .filter((teammate) => teammate.assignable)
      .map((teammate) => ({
        value: encodeWorkActor({ type: "teammate", id: teammate.id }),
        label: teammate.name,
      })),
    ...directory.people.map((person) => ({
      value: encodeWorkActor({ type: "person", userId: person.userId }),
      label: person.name ?? "Person",
    })),
  ];
}
