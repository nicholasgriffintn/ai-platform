import z from "zod/v4";

export const THREAD_LEASE_DURATION_MS = 5 * 60 * 1000;
export const THREAD_LEASE_RENEWAL_INTERVAL_MS = 60 * 1000;

export const threadOperationSchema = z.enum([
  "user_message",
  "compact",
  "edit_messages",
  "human_response",
  "connector_replay",
  "async_result",
  "session_compaction",
  "durable_recovery",
]);

export type ThreadOperation = z.infer<typeof threadOperationSchema>;

export const threadCoordinatorStatusSchema = z.enum(["idle", "running"]);
export type ThreadCoordinatorStatus = z.infer<typeof threadCoordinatorStatusSchema>;

export const threadStatusSchema = z.object({
  status: threadCoordinatorStatusSchema,
  currentOperation: threadOperationSchema.nullable(),
});

export const threadLeaseOwnerTokenSchema = z.string().min(1).max(128);

export const threadLeaseAcquireRequestSchema = z.object({
  kind: threadOperationSchema,
  ownerToken: threadLeaseOwnerTokenSchema,
});

export const threadLeaseOwnerRequestSchema = z.object({
  ownerToken: threadLeaseOwnerTokenSchema,
});

export const threadLeaseAcquisitionSchema = z.discriminatedUnion("acquired", [
  z.object({
    acquired: z.literal(true),
    currentOperation: threadOperationSchema,
    expiresAt: z.iso.datetime(),
  }),
  z.object({
    acquired: z.literal(false),
    currentOperation: threadOperationSchema.nullable(),
  }),
]);

export const threadLeaseRenewalSchema = z.discriminatedUnion("renewed", [
  z.object({ renewed: z.literal(true), expiresAt: z.iso.datetime() }),
  z.object({ renewed: z.literal(false) }),
]);

export const threadLeaseOwnershipSchema = z.discriminatedUnion("owned", [
  z.object({ owned: z.literal(true), expiresAt: z.iso.datetime() }),
  z.object({ owned: z.literal(false) }),
]);

export const threadLeaseReleaseSchema = z.object({ released: z.boolean() });

export type ThreadLeaseAcquisition = z.infer<typeof threadLeaseAcquisitionSchema>;
export type ThreadLeaseRenewal = z.infer<typeof threadLeaseRenewalSchema>;
export type ThreadLeaseOwnership = z.infer<typeof threadLeaseOwnershipSchema>;
