import z from "zod/v4";

export const BEDROCK_MANAGED_AGENT_REGIONS = ["us-east-1", "us-east-2", "us-west-2"] as const;
export const bedrockManagedAgentRegionSchema = z.enum(BEDROCK_MANAGED_AGENT_REGIONS);
export type BedrockManagedAgentRegion = z.infer<typeof bedrockManagedAgentRegionSchema>;

export const managedAgentIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (id) =>
      id !== "." &&
      id !== ".." &&
      id
        .split("")
        .every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127),
    "Invalid identifier",
  );
export const managedAgentParamsSchema = z.object({ id: managedAgentIdSchema }).strict();
const absolutePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .startsWith("/")
  .refine((path) => !path.includes("\0"), "Paths must not contain null bytes");

export const bedrockManagedAgentEnvironmentSchema = z
  .object({
    type: z.literal("aws_bedrock_agentcore"),
    runtime_arn: z
      .string()
      .regex(
        /^arn:aws:bedrock-agentcore:(us-east-1|us-east-2|us-west-2):[0-9]{12}:runtime\/[A-Za-z0-9_-]+$/,
        "Use an AgentCore Runtime ARN in a supported Bedrock Managed Agents region",
      ),
    runtime_qualifier: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("DEFAULT"),
    workspace_directory: absolutePathSchema,
    capability_directories: z
      .array(absolutePathSchema)
      .max(32)
      .refine(
        (paths) => new Set(paths).size === paths.length,
        "Capability directories must be unique",
      )
      .default([]),
  })
  .strict();
export type BedrockManagedAgentEnvironment = z.infer<typeof bedrockManagedAgentEnvironmentSchema>;

export const createManagedAgentSessionSchema = z
  .object({
    agent: z
      .object({
        model: z
          .string()
          .min(1)
          .max(256)
          .regex(/^openai\.[A-Za-z0-9._-]+$/),
        instructions: z.string().max(32_000).optional(),
      })
      .strict(),
    environment: bedrockManagedAgentEnvironmentSchema,
    role_arn: z.string().regex(/^arn:aws:iam::[0-9]{12}:role\/[A-Za-z0-9_+=,.@/-]+$/),
  })
  .strict()
  .refine(
    (request) => request.role_arn.split(":")[4] === request.environment.runtime_arn.split(":")[4],
    {
      message: "The session role and Runtime must belong to the same AWS account",
      path: ["role_arn"],
    },
  );
export type CreateManagedAgentSession = z.infer<typeof createManagedAgentSessionSchema>;

export const managedAgentMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(64_000),
  })
  .strict();
export type ManagedAgentMessage = z.infer<typeof managedAgentMessageSchema>;
export const managedAgentPageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    after: z.string().min(1).max(2048).optional(),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();
export type ManagedAgentPageQuery = z.infer<typeof managedAgentPageQuerySchema>;
export const managedAgentListQuerySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .strict();

export const bedrockManagedAgentSessionSchema = z.object({
  id: managedAgentIdSchema,
  status: z.enum(["idle", "in_progress", "failed"]),
  agent: z.object({ model: z.string().min(1) }),
  environment: bedrockManagedAgentEnvironmentSchema.strip(),
  role_arn: z.string(),
});
export type BedrockManagedAgentSession = z.infer<typeof bedrockManagedAgentSessionSchema>;

export const bedrockManagedAgentSessionsPageSchema = z.object({
  data: z.array(bedrockManagedAgentSessionSchema),
  has_more: z.boolean(),
  first_id: managedAgentIdSchema.nullable(),
  last_id: managedAgentIdSchema.nullable(),
});
export type BedrockManagedAgentSessionsPage = z.infer<typeof bedrockManagedAgentSessionsPageSchema>;

export const managedAgentItemSchema = z
  .object({
    id: managedAgentIdSchema,
    type: z.string().min(1),
    turn_id: managedAgentIdSchema.optional(),
  })
  .passthrough();
export const managedAgentItemsSchema = z.object({
  data: z.array(managedAgentItemSchema),
  has_more: z.boolean(),
  first_id: managedAgentIdSchema.nullable(),
  last_id: managedAgentIdSchema.nullable(),
});
export type ManagedAgentItems = z.infer<typeof managedAgentItemsSchema>;

export const managedAgentSessionBindingSchema = z
  .object({
    provider: z.literal("bedrock-managed-agents"),
    sessionId: managedAgentIdSchema.nullable(),
    configuration: createManagedAgentSessionSchema,
    deleted: z.boolean().default(false),
  })
  .strict();
export const managedAgentSessionSchema = z.object({
  id: managedAgentIdSchema,
  provider: z.literal("bedrock-managed-agents"),
  sessionId: managedAgentIdSchema.nullable(),
  projectId: z.string().nullable(),
  model: z.string(),
  environment: bedrockManagedAgentEnvironmentSchema,
  roleArn: z.string(),
  status: z.enum(["queued", "running", "waiting", "succeeded", "failed", "cancelled"]),
  deleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ManagedAgentSession = z.infer<typeof managedAgentSessionSchema>;
export const managedAgentSessionResponseSchema = z.object({ session: managedAgentSessionSchema });
export const managedAgentSessionsResponseSchema = z.object({
  sessions: z.array(managedAgentSessionSchema),
});
export const managedAgentAcceptedSchema = z.object({ accepted: z.literal(true) });
export const managedAgentDeletedSchema = z.object({ deleted: z.literal(true) });
