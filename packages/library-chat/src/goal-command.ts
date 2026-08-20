export const GOAL_COMMAND = "/goal";

export type GoalCommand =
  | { kind: "status" }
  | { kind: "set"; objective: string }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "clear" };

const RESERVED_SUBCOMMANDS = new Set(["pause", "resume", "clear"]);

/**
 * `/goal` on its own reports the current goal; `/goal <anything else>` is an
 * objective. A reserved word only counts as a subcommand when it stands alone,
 * so "/goal pause the rollout until errors drop" still reads as an objective.
 */
export function parseGoalCommand(input: string): GoalCommand | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const [command, ...rest] = trimmed.split(/\s+/);

  if (command.toLowerCase() !== GOAL_COMMAND) {
    return null;
  }

  if (rest.length === 0) {
    return { kind: "status" };
  }

  if (rest.length === 1) {
    const subcommand = rest[0].toLowerCase();

    if (RESERVED_SUBCOMMANDS.has(subcommand)) {
      return { kind: subcommand as "pause" | "resume" | "clear" };
    }
  }

  const objective = trimmed.slice(command.length).trim();

  return objective ? { kind: "set", objective } : { kind: "status" };
}

export function isGoalCommand(input: string): boolean {
  return parseGoalCommand(input) !== null;
}
