import z from "zod/v4";

export const CONVERSATION_LOCK_VERSION = 1;

export const CONVERSATION_LOCK_PBKDF2_ITERATIONS = 600_000;

export const CONVERSATION_LOCK_CONTEXT_TOKEN_CAP = 96_000;

const base64UrlSchema = z
  .string()
  .min(1)
  .max(8192)
  .regex(/^[A-Za-z0-9_-]+$/, "Expected unpadded base64url");

export const conversationLockKeyTypeSchema = z.enum(["passkey", "password", "recovery"]);

export const conversationLockKdfSchema = z.literal("pbkdf2-sha256");

export const sealedEnvelopeSchema = z.object({
  v: z.literal(CONVERSATION_LOCK_VERSION).describe("Envelope format version."),
  iv: base64UrlSchema.describe("AES-GCM initialisation vector, base64url."),
  ct: z
    .string()
    .min(1)
    .max(2_000_000)
    .regex(/^[A-Za-z0-9_-]+$/)
    .describe("AES-GCM ciphertext and tag, base64url."),
});

export type SealedEnvelope = z.infer<typeof sealedEnvelopeSchema>;

export const conversationLockKeySchema = z.object({
  id: z.string().min(1).max(64),
  type: conversationLockKeyTypeSchema,
  credential_id: z
    .string()
    .min(1)
    .max(1024)
    .nullable()
    .describe("WebAuthn credential ID for passkey keys, base64url."),
  label: z.string().min(1).max(120).nullable(),
  salt: base64UrlSchema.describe("PRF salt for passkey keys, KDF salt for password keys."),
  kdf: conversationLockKdfSchema.nullable(),
  kdf_iterations: z.number().int().positive().max(10_000_000).nullable(),
  wrapped_key: sealedEnvelopeSchema.describe("The conversation key, sealed by this key."),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
});

export type ConversationLockKey = z.infer<typeof conversationLockKeySchema>;

export const conversationLockKeyInputSchema = conversationLockKeySchema
  .omit({ id: true, created_at: true, last_used_at: true })
  .superRefine((key, ctx) => {
    if (key.type === "passkey" && !key.credential_id) {
      ctx.addIssue({
        code: "custom",
        path: ["credential_id"],
        message: "Passkey lock keys must name the credential that produced them",
      });
    }

    if (key.type === "password" && (!key.kdf || !key.kdf_iterations)) {
      ctx.addIssue({
        code: "custom",
        path: ["kdf"],
        message: "Password lock keys must record their derivation parameters",
      });
    }
  });

export type ConversationLockKeyInput = z.infer<typeof conversationLockKeyInputSchema>;

export const conversationLockSchema = z.object({
  conversation_id: z.string().min(1),
  version: z.number().int().positive(),
  title: sealedEnvelopeSchema.nullable(),
  keys: z.array(conversationLockKeySchema),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});

export type ConversationLock = z.infer<typeof conversationLockSchema>;

export const lockedMessageRoleSchema = z.enum(["user", "assistant"]);

export const lockedMessageSchema = z.object({
  id: z.string().min(1).max(64),
  seq: z.number().int().nonnegative(),
  role: lockedMessageRoleSchema,
  envelope: sealedEnvelopeSchema,
  created_at: z.string(),
});

export type LockedMessage = z.infer<typeof lockedMessageSchema>;

export const lockedMessageInputSchema = lockedMessageSchema.omit({
  created_at: true,
});

export type LockedMessageInput = z.infer<typeof lockedMessageInputSchema>;

export const conversationLockParamsSchema = z.object({
  completion_id: z.string().min(1),
});

export const conversationLockKeyParamsSchema = z.object({
  completion_id: z.string().min(1),
  key_id: z.string().min(1),
});

export const createConversationLockJsonSchema = z.object({
  version: z.literal(CONVERSATION_LOCK_VERSION),
  title: sealedEnvelopeSchema.nullable().optional(),
  keys: z.array(conversationLockKeyInputSchema).min(1).max(10),
  messages: z.array(lockedMessageInputSchema).max(2000).optional(),
});

export type CreateConversationLockInput = z.infer<typeof createConversationLockJsonSchema>;

export const addConversationLockKeyJsonSchema = z.object({
  key: conversationLockKeyInputSchema,
});

export const updateConversationLockTitleJsonSchema = z.object({
  title: sealedEnvelopeSchema.nullable(),
});

export const appendLockedMessagesJsonSchema = z.object({
  messages: z.array(lockedMessageInputSchema).min(1).max(200),
  title: sealedEnvelopeSchema.nullable().optional(),
});

export const listLockedMessagesResponseSchema = z.object({
  conversation_id: z.string(),
  messages: z.array(lockedMessageSchema),
});

export const conversationLockResponseSchema = z.object({
  lock: conversationLockSchema,
});

export const deleteConversationLockJsonSchema = z.object({
  title: z.string().max(512).nullable().optional(),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        role: lockedMessageRoleSchema,
        content: z.string().max(1_000_000),
        model: z.string().max(200).nullable().optional(),
      }),
    )
    .max(2000)
    .describe("Plaintext to restore when the lock is removed."),
});

export type DeleteConversationLockInput = z.infer<typeof deleteConversationLockJsonSchema>;

export const conversationLockMutationResponseSchema = z.object({
  success: z.boolean(),
});

export const LOCKED_CONVERSATION_FORBIDDEN_CAPABILITIES = [
  "tools",
  "retrieval",
  "memory",
  "attachments",
  "sharing",
  "projects",
  "agents",
  "goals",
  "compaction",
  "multi-model",
  "background",
] as const;

export type LockedConversationForbiddenCapability =
  (typeof LOCKED_CONVERSATION_FORBIDDEN_CAPABILITIES)[number];

export interface LockedTurnRequestShape {
  approved_tools?: unknown;
  background?: unknown;
  compaction?: unknown;
  enabled_tools?: unknown;
  models?: unknown;
  options?: {
    agent?: unknown;
    connector?: unknown;
    recipe?: unknown;
    sandbox?: unknown;
  } | null;
  rag_options?: unknown;
  store?: unknown;
  tool_options?: unknown;
  use_multi_model?: unknown;
  use_rag?: unknown;
}

function hasEntries(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

export function findLockedTurnViolations(request: LockedTurnRequestShape): string[] {
  const violations: string[] = [];

  if (request.store !== false) {
    violations.push("Locked conversations cannot be stored on the server");
  }

  if (hasEntries(request.enabled_tools) || hasEntries(request.approved_tools)) {
    violations.push("Locked conversations cannot use tools");
  }

  if (hasEntries(request.tool_options)) {
    violations.push("Locked conversations cannot use hosted tools");
  }

  if (request.use_rag === true || hasEntries(request.rag_options)) {
    violations.push("Locked conversations cannot use retrieval");
  }

  if (request.use_multi_model === true || hasEntries(request.models)) {
    violations.push("Locked conversations cannot use multiple models");
  }

  if (request.background === true) {
    violations.push("Locked conversations cannot run in background mode");
  }

  if (request.compaction !== undefined && request.compaction !== "off") {
    violations.push("Locked conversations cannot be compacted on the server");
  }

  const options = request.options;

  if (options?.agent) {
    violations.push("Locked conversations cannot use agents");
  }

  if (options?.recipe || options?.connector) {
    violations.push("Locked conversations cannot use connectors or recipes");
  }

  if (options?.sandbox) {
    violations.push("Locked conversations cannot use the sandbox");
  }

  return violations;
}
