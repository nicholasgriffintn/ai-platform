import type { PetClipName, PolyAgenda } from "@ngriffin_uk/polychat-schemas";

export interface PolyPresence {
  clip: PetClipName;
  status: string;
  needsYou: number;
  workingOn: number;
}

function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace("{count}", String(count));
}

export function derivePolyPresence(agenda: PolyAgenda): PolyPresence {
  const needsYou = agenda.needs_you.length;
  const workingOn = agenda.working_on.length;

  if (needsYou > 0) {
    return {
      clip: "greet",
      status: countLabel(needsYou, "One thing needs you", "{count} things need you"),
      needsYou,
      workingOn,
    };
  }

  if (workingOn > 0) {
    return {
      clip: "work",
      status: countLabel(workingOn, "Working on one thing", "Working on {count} things"),
      needsYou,
      workingOn,
    };
  }

  return { clip: "idle", status: "Ready when you are", needsYou, workingOn };
}
