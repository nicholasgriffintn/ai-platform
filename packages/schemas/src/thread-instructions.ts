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

/**
 * `cancel` is the only instruction that pre-empts work in flight. Everything
 * else waits for a safe boundary, so nothing mutates a conversation's history
 * while another operation is midway through it.
 */
export const PREEMPTIVE_THREAD_INSTRUCTIONS: readonly ThreadInstructionKind[] = ["cancel"];

export function isPreemptiveInstruction(kind: ThreadInstructionKind): boolean {
  return PREEMPTIVE_THREAD_INSTRUCTIONS.includes(kind);
}

export const submitThreadInstructionSchema = z.object({
  kind: threadInstructionKindSchema,
  content: z.string().trim().max(8000).optional(),
  objective: z.string().trim().max(2000).optional(),
  requestId: z.string().trim().min(1).optional(),
});

export type SubmitThreadInstruction = z.infer<typeof submitThreadInstructionSchema>;

export const threadInstructionSchema = submitThreadInstructionSchema.extend({
  id: z.string(),
  index: z.number().int().min(0),
  enqueuedAt: z.string(),
});

export type ThreadInstruction = z.infer<typeof threadInstructionSchema>;

export const threadCoordinatorStatusSchema = z.enum(["idle", "running"]);
export type ThreadCoordinatorStatus = z.infer<typeof threadCoordinatorStatusSchema>;

export const threadCoordinatorStateSchema = z.object({
  status: threadCoordinatorStatusSchema,
  currentOperation: threadInstructionKindSchema.nullable(),
  queue: z.array(threadInstructionSchema),
  updatedAt: z.string(),
});

export type ThreadCoordinatorState = z.infer<typeof threadCoordinatorStateSchema>;

export interface ThreadDrainInput {
  status: ThreadCoordinatorStatus;
  queue: readonly ThreadInstruction[];
}

export interface ThreadDrainDecision {
  next: ThreadInstruction | null;
  reason: "idle" | "busy" | "empty" | "preempt" | "superseded";
}

/**
 * The single rule for what runs next on a thread. A queued user message always
 * beats a goal continuation, and a continuation whose turn has passed is
 * dropped rather than deferred: the next boundary re-evaluates whether the goal
 * still needs one.
 */
export function resolveNextInstruction(input: ThreadDrainInput): ThreadDrainDecision {
  const queue = [...input.queue];

  if (queue.length === 0) {
    return { next: null, reason: "empty" };
  }

  const preemptive = queue.find((instruction) => isPreemptiveInstruction(instruction.kind));

  if (preemptive) {
    return { next: preemptive, reason: "preempt" };
  }

  if (input.status === "running") {
    return { next: null, reason: "busy" };
  }

  const head = queue[0];

  if (head.kind === "goal_continuation") {
    const hasUserWork = queue.some((instruction) => instruction.kind !== "goal_continuation");

    if (hasUserWork) {
      return { next: null, reason: "superseded" };
    }
  }

  return { next: head, reason: "idle" };
}
