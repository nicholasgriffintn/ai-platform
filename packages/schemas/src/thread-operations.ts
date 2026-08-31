import z from "zod/v4";

export const threadOperationSchema = z.enum([
  "user_message",
  "compact",
  "edit_messages",
  "human_response",
  "connector_replay",
  "async_result",
  "session_compaction",
]);

export type ThreadOperation = z.infer<typeof threadOperationSchema>;

export const threadCoordinatorStatusSchema = z.enum(["idle", "running"]);
export type ThreadCoordinatorStatus = z.infer<typeof threadCoordinatorStatusSchema>;
