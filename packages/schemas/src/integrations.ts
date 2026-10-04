import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const NATIVE_MCP_TOOL_NAME = "use_mcp_integration";

export const integrationIdSchema = z
  .string()
  .regex(/^mcp_[a-zA-Z0-9_-]+$/)
  .max(100);
export const integrationOperationSchema = z.string().trim().min(1).max(200);
const integrationTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(8192)
  .regex(/^[^\r\n]+$/);

export const integrationEndpointSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.search &&
      !isPrivateHostname(url.hostname)
    );
  }, "Use a public HTTPS endpoint without credentials, a query or a fragment");

export const integrationToolSchema = z.object({
  name: integrationOperationSchema,
  description: z.string().max(16000).optional(),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  annotations: z
    .object({
      readOnlyHint: z.boolean().optional(),
      destructiveHint: z.boolean().optional(),
      idempotentHint: z.boolean().optional(),
      openWorldHint: z.boolean().optional(),
    })
    .optional(),
});

export const integrationSnapshotSchema = z.object({
  endpoint: integrationEndpointSchema,
  authentication: z.enum(["none", "bearer"]),
  tools: z.array(integrationToolSchema).max(500),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});

export const integrationDefinitionSchema = z.object({
  id: integrationIdSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  workspaceId: z.string().min(1).nullable(),
  revision: z.number().int().positive(),
  snapshot: integrationSnapshotSchema,
  revoked: z.boolean(),
  canManage: z.boolean(),
  connected: z.boolean(),
  createdAt: z.string(),
});

export const createIntegrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(""),
  workspaceId: z.string().min(1).optional(),
  endpoint: integrationEndpointSchema,
  authentication: z.enum(["none", "bearer"]),
  token: integrationTokenSchema.optional(),
});

export const integrationConnectionSchema = z.object({
  token: integrationTokenSchema.optional(),
});

export const integrationGrantSchema = z.object({
  revision: z.number().int().positive(),
  operations: z.array(integrationOperationSchema).min(1).max(500),
});

export const connectorGrantSchema = z.object({
  operations: z.array(integrationOperationSchema).min(1).max(500),
});

export const connectorOperationsResponseSchema = z.object({
  operations: z.array(
    z.object({
      id: integrationOperationSchema,
      access: z.enum(["read", "write"]),
      destructive: z.boolean(),
    }),
  ),
});

export const integrationListResponseSchema = z.object({
  integrations: z.array(integrationDefinitionSchema),
});

export const integrationResponseSchema = z.object({
  integration: integrationDefinitionSchema,
});

export const integrationRefreshSchema = z.object({
  expectedRevision: z.number().int().positive(),
  expectedDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export const integrationReviewResponseSchema = z.object({
  currentRevision: z.number().int().positive(),
  snapshot: integrationSnapshotSchema,
});

export const integrationDiscoverySchema = z.object({
  provider: integrationIdSchema,
  operation: integrationOperationSchema.optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export type IntegrationTool = z.infer<typeof integrationToolSchema>;
export type IntegrationSnapshot = z.infer<typeof integrationSnapshotSchema>;
export type IntegrationDefinition = z.infer<typeof integrationDefinitionSchema>;
export type CreateIntegration = z.infer<typeof createIntegrationSchema>;
export type IntegrationGrant = z.infer<typeof integrationGrantSchema>;
export type IntegrationDiscovery = z.infer<typeof integrationDiscoverySchema>;
