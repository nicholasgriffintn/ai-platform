import type { StreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { getRunningStreamActivityTools } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { PetClipName } from "@ngriffin_uk/polychat-schemas";

export const PET_CHEER_WINDOW_MS = 3000;
export const PET_DOZE_AFTER_MS = 5 * 60 * 1000;

export interface PetPresenceInput {
  activity: StreamActivity | null;
  isRecovering: boolean;
  lastCompletedAt: number | null;
  lastActiveAt: number | null;
  now: number;
}

export interface PetPresence {
  clip: PetClipName;
  status: string;
}

const STATUS: Record<PetClipName, string> = {
  idle: "Ready when you are",
  blink: "Ready when you are",
  preen: "Ready when you are",
  greet: "Ready when you are",
  think: "Reading it over",
  work: "Running a tool",
  speak: "Answering",
  cheer: "Done",
  fret: "Lost the thread, reconnecting",
  doze: "Dozing",
  flit: "On the way",
};

function statusFor(clip: PetClipName, toolName?: string): string {
  if (clip === "work" && toolName) {
    return `Running ${toolName}`;
  }

  return STATUS[clip];
}

export function derivePetPresence(input: PetPresenceInput): PetPresence {
  if (input.isRecovering) {
    return { clip: "fret", status: statusFor("fret") };
  }

  if (input.activity) {
    const running = getRunningStreamActivityTools(input.activity);

    if (running.length > 0) {
      return { clip: "work", status: statusFor("work", running[0].name) };
    }

    if (input.activity.contentChars > 0) {
      return { clip: "speak", status: statusFor("speak") };
    }

    return { clip: "think", status: statusFor("think") };
  }

  if (input.lastCompletedAt !== null && input.now - input.lastCompletedAt <= PET_CHEER_WINDOW_MS) {
    return { clip: "cheer", status: statusFor("cheer") };
  }

  if (input.lastActiveAt !== null && input.now - input.lastActiveAt >= PET_DOZE_AFTER_MS) {
    return { clip: "doze", status: statusFor("doze") };
  }

  return { clip: "idle", status: statusFor("idle") };
}
