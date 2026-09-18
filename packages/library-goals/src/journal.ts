import type { GoalProgressEntry } from "@ngriffin_uk/polychat-schemas";

export const GOAL_PROGRESS_JOURNAL_LIMIT = 40;

export function appendGoalProgressEntry(
  progress: GoalProgressEntry[],
  entry: GoalProgressEntry,
): GoalProgressEntry[] {
  return [...progress, entry].slice(-GOAL_PROGRESS_JOURNAL_LIMIT);
}
