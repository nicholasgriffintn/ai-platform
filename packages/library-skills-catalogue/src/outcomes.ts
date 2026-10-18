import type { SkillOutcomeVerdict } from "@ngriffin_uk/polychat-schemas";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SKILL_OUTCOME_WINDOW_DAYS = 30;
export const SKILL_STRUGGLING_THUMBS_DOWN = 3;

export interface SkillOutcomeSignals {
  usesTotal: number;
  usesInWindow: number;
  thumbsUp: number;
  thumbsDown: number;
  corrections: number;
  createdAt: string;
  now: number;
}

export function assessSkillOutcomes(signals: SkillOutcomeSignals): SkillOutcomeVerdict {
  const ageMs = signals.now - Date.parse(signals.createdAt);

  if (signals.thumbsDown >= SKILL_STRUGGLING_THUMBS_DOWN && signals.thumbsDown > signals.thumbsUp) {
    return "struggling";
  }

  if (ageMs < SKILL_OUTCOME_WINDOW_DAYS * DAY_MS && signals.usesTotal === 0) {
    return "new";
  }

  if (signals.usesInWindow === 0) {
    return "unused";
  }

  return "healthy";
}
