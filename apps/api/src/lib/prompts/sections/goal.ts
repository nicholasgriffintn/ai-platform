import type { Goal, GoalProgressEntry } from "@ngriffin_uk/polychat-schemas";

const JOURNAL_TAIL_LENGTH = 5;

function formatJournalEntry(entry: GoalProgressEntry): string {
  const parts = [`- [${entry.surface}] ${entry.summary}`];

  if (entry.steer) {
    parts.push(`  steer: ${entry.steer}`);
  }

  if (entry.evidence.length > 0) {
    parts.push(`  evidence: ${entry.evidence.join(", ")}`);
  }

  if (entry.next) {
    parts.push(`  next: ${entry.next}`);
  }

  return parts.join("\n");
}

export function buildGoalContractSection(goal: Goal): string {
  const journal = goal.progress.slice(-JOURNAL_TAIL_LENGTH);
  const lines = [
    "<active_goal>",
    `<objective>${goal.objective}</objective>`,
    "<completion_rule>",
    "Completion is decided by evidence, never by how finished the work feels. Before claiming the objective is met, audit it against what this thread actually shows: files changed, commands run, tool results returned, artifacts produced, sources read.",
    "When the objective is genuinely satisfied, call complete_goal with an evidence ledger. Each entry names the claim, how it was established, where the evidence lives, and how strongly it supports the claim.",
    "</completion_rule>",
    "<blocked_rule>",
    "If no defensible path remains, or the work needs the user's input or an approval, stop and report the paths attempted, the evidence gathered, the blocker, and what would unblock it. Do not manufacture another attempt to look busy.",
    "</blocked_rule>",
  ];

  if (goal.stall_streak > 0) {
    lines.push(
      "<stall_warning>",
      "The previous continuation produced no new evidence. Either take a materially different approach now, or report the blocker. Repeating the last attempt will end the goal.",
      "</stall_warning>",
    );
  }

  if (journal.length > 0) {
    lines.push(
      "<progress_so_far>",
      `Iteration ${goal.iteration_count}. What has already been tried:`,
      ...journal.map(formatJournalEntry),
      "</progress_so_far>",
    );
  }

  lines.push("</active_goal>");

  return `${lines.join("\n")}\n`;
}
