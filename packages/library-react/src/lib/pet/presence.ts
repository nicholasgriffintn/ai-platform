import type { StreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { getRunningStreamActivityTools } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { PetStateName } from "@ngriffin_uk/polychat-schemas";

export const PET_CHEER_WINDOW_MS = 3000;
export const PET_ACKNOWLEDGE_WINDOW_MS = 2500;
export const PET_DOZE_AFTER_MS = 5 * 60 * 1000;

export type PetAccent = "alert" | "drop" | "sleep" | "rings" | "spark";

export type CharacterVoiceState = "off" | "listening" | "speaking";

export interface CharacterAgendaSignal {
  needsYou: number;
  workingOn: number;
  pausedUntil: string | null;
}

export interface CharacterPresenceInput {
  activity: StreamActivity | null;
  isRecovering: boolean;
  voice: CharacterVoiceState;
  reviewing: boolean;
  agenda: CharacterAgendaSignal | null;
  lastCompletedAt: number | null;
  lastActiveAt: number | null;
  lastArrivedAt: number | null;
  now: number;
  formatTime: (iso: string) => string;
}

export interface CharacterPresence {
  state: PetStateName;
  status: string;
  accent: PetAccent | null;
  needsYou: number;
  workingOn: number;
}

const READY = "Ready when you are";

function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? one : many.replace("{count}", String(count));
}

function presence(
  state: PetStateName,
  status: string,
  accent: PetAccent | null,
  agenda: CharacterAgendaSignal | null,
): CharacterPresence {
  return {
    state,
    status,
    accent,
    needsYou: agenda?.needsYou ?? 0,
    workingOn: agenda?.workingOn ?? 0,
  };
}

function isPaused(
  agenda: CharacterAgendaSignal | null,
  now: number,
): agenda is CharacterAgendaSignal & {
  pausedUntil: string;
} {
  return Boolean(agenda?.pausedUntil && Date.parse(agenda.pausedUntil) > now);
}

export interface TeammateWorkSignal {
  needsYou: readonly { teammate_id?: string | null; title: string }[];
  workingOn: readonly { teammate_id?: string | null; title: string }[];
}

export function deriveTeammatePresence(
  signal: TeammateWorkSignal | null,
  teammateId: string,
): Pick<CharacterPresence, "state" | "status" | "accent"> {
  const waiting = signal?.needsYou.find((item) => item.teammate_id === teammateId);

  if (waiting) {
    return { state: "wait", status: `Waiting on you: ${waiting.title}`, accent: "alert" };
  }

  const working = signal?.workingOn.find((item) => item.teammate_id === teammateId);

  if (working) {
    return { state: "work", status: `Working on ${working.title}`, accent: null };
  }

  return { state: "idle", status: READY, accent: null };
}

export function deriveCharacterPresence(input: CharacterPresenceInput): CharacterPresence {
  const { agenda, now } = input;

  if (input.isRecovering) {
    return presence("fret", "Lost the thread, reconnecting", "drop", agenda);
  }

  if (input.voice === "listening") {
    return presence("listen", "Listening", "rings", agenda);
  }

  if (input.voice === "speaking") {
    return presence("speak", "Talking", null, agenda);
  }

  if (input.reviewing) {
    return presence("review", "Waiting for your answer", "alert", agenda);
  }

  if (input.activity) {
    const running = getRunningStreamActivityTools(input.activity);

    if (running.length > 0) {
      return presence("work", `Running ${running[0].name}`, null, agenda);
    }

    if (input.activity.contentChars > 0) {
      return presence("speak", "Answering", null, agenda);
    }

    return presence("think", "Reading it over", null, agenda);
  }

  if (agenda && agenda.needsYou > 0) {
    return presence(
      "wait",
      countLabel(agenda.needsYou, "One thing needs you", "{count} things need you"),
      "alert",
      agenda,
    );
  }

  if (input.lastArrivedAt !== null && now - input.lastArrivedAt <= PET_ACKNOWLEDGE_WINDOW_MS) {
    return presence("acknowledge", "Got it, starting on that", null, agenda);
  }

  if (input.lastCompletedAt !== null && now - input.lastCompletedAt <= PET_CHEER_WINDOW_MS) {
    return presence("cheer", "Done", "spark", agenda);
  }

  if (isPaused(agenda, now)) {
    return presence(
      "doze",
      `Paused until ${input.formatTime(agenda.pausedUntil)}`,
      "sleep",
      agenda,
    );
  }

  if (agenda && agenda.workingOn > 0) {
    return presence(
      "work",
      countLabel(agenda.workingOn, "Working on one thing", "Working on {count} things"),
      null,
      agenda,
    );
  }

  if (input.lastActiveAt !== null && now - input.lastActiveAt >= PET_DOZE_AFTER_MS) {
    return presence("doze", "Dozing", "sleep", agenda);
  }

  return presence("idle", READY, null, agenda);
}
