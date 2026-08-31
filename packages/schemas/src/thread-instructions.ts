import z from "zod/v4";

export const threadInstructionKindSchema = z.enum([
  "user_message",
  "goal_continuation",
  "compact",
  "goal_set",
  "goal_pause",
  "goal_resume",
  "goal_clear",
  "title",
  "cancel",
]);

export type ThreadInstructionKind = z.infer<typeof threadInstructionKindSchema>;

export const threadCoordinatorStatusSchema = z.enum(["idle", "running"]);
export type ThreadCoordinatorStatus = z.infer<typeof threadCoordinatorStatusSchema>;
