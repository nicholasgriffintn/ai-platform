import type { ConversationSnoozeChoice } from "@ngriffin_uk/polychat-component-navigation";
import type { ConversationSnooze } from "@ngriffin_uk/polychat-schemas";

export function nextLocalMorning(now = new Date()): string {
  const nextMorning = new Date(now);

  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(9, 0, 0, 0);

  return nextMorning.toISOString();
}

export function resolveSnoozeChoice(
  choice: ConversationSnoozeChoice | null,
  now = new Date(),
): ConversationSnooze | null {
  if (choice === "tomorrow") {
    return { kind: "until", until: nextLocalMorning(now) };
  }

  if (choice === "next_response") {
    return { kind: "next_response" };
  }

  return null;
}
