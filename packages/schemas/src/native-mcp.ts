import { containsControlCharacters, isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const nativeMcpIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

export const nativeMcpEndpointSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !isPrivateHostname(url.hostname)
    );
  }, "Use a public HTTPS endpoint without credentials, query parameters or a fragment");

export const nativeMcpToolSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => !containsControlCharacters(value)),
    description: z.string().max(4000).optional(),
    inputSchema: z
      .record(z.string(), z.unknown())
      .refine((value) => value.type === "object", "Tool inputs must use an object schema"),
    outputSchema: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

export const nativeMcpCatalogToolSchema = nativeMcpToolSchema.extend({
  schemaDigest: z.string().regex(/^[a-f0-9]{64}$/),
  access: z.enum(["disabled", "read", "write"]),
});

export const createNativeMcpServerSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    endpoint: nativeMcpEndpointSchema,
    workspaceId: nativeMcpIdSchema.optional(),
  })
  .strict();

export const updateNativeMcpServerSchema = z
  .object({
    revision: z.int().positive(),
    enabled: z.boolean(),
    tools: z
      .array(
        z
          .object({
            name: nativeMcpToolSchema.shape.name,
            schemaDigest: nativeMcpCatalogToolSchema.shape.schemaDigest,
            access: nativeMcpCatalogToolSchema.shape.access,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const nativeMcpCredentialSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z
    .object({
      type: z.literal("bearer"),
      value: z
        .string()
        .min(1)
        .max(4096)
        .regex(/^[A-Za-z0-9._~+/-]+=*$/),
    })
    .strict(),
  z
    .object({
      type: z.literal("api-key"),
      value: z
        .string()
        .min(1)
        .max(4096)
        .regex(/^[\x21-\x7e]+$/),
    })
    .strict(),
]);

export const connectNativeMcpServerSchema = z
  .object({
    endpointConsent: z.literal(true),
    credential: nativeMcpCredentialSchema,
    sharedProjectIds: z
      .array(nativeMcpIdSchema)
      .max(50)
      .refine((values) => new Set(values).size === values.length),
  })
  .strict();

export const nativeMcpServerSchema = createNativeMcpServerSchema.extend({
  id: nativeMcpIdSchema,
  revision: z.int().positive(),
  enabled: z.boolean(),
  tools: z.array(nativeMcpCatalogToolSchema).max(100),
  managed: z.boolean(),
  connected: z.boolean(),
  connectionRevision: z.int().positive().nullable(),
  sharedProjectIds: z.array(nativeMcpIdSchema),
});

export const nativeMcpServerListSchema = z.object({
  servers: z.array(nativeMcpServerSchema).max(100),
});

export const nativeMcpCallSchema = z
  .object({
    serverId: nativeMcpIdSchema,
    operation: nativeMcpToolSchema.shape.name,
    schemaDigest: nativeMcpCatalogToolSchema.shape.schemaDigest,
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const nativeMcpContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image"), data: z.string(), mimeType: z.string().max(200) }),
  z.object({ type: z.literal("audio"), data: z.string(), mimeType: z.string().max(200) }),
  z.object({
    type: z.literal("resource_link"),
    uri: z.string().max(2048),
    name: z.string().max(200),
    title: z.string().max(200).optional(),
    description: z.string().max(4000).optional(),
    mimeType: z.string().max(200).optional(),
    size: z.int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("resource"),
    resource: z.union([
      z.object({
        uri: z.string().max(2048),
        mimeType: z.string().max(200).optional(),
        text: z.string(),
      }),
      z.object({
        uri: z.string().max(2048),
        mimeType: z.string().max(200).optional(),
        blob: z.string(),
      }),
    ]),
  }),
]);

export const nativeMcpToolResultSchema = z.object({
  resultType: z.literal("complete"),
  content: z.array(nativeMcpContentSchema).max(100),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

export type NativeMcpCredential = z.infer<typeof nativeMcpCredentialSchema>;
export type NativeMcpTool = z.infer<typeof nativeMcpToolSchema>;
export type NativeMcpCatalogTool = z.infer<typeof nativeMcpCatalogToolSchema>;
export type NativeMcpServer = z.infer<typeof nativeMcpServerSchema>;
export type NativeMcpCall = z.infer<typeof nativeMcpCallSchema>;
export type NativeMcpToolResult = z.infer<typeof nativeMcpToolResultSchema>;
export type CreateNativeMcpServer = z.infer<typeof createNativeMcpServerSchema>;
export type UpdateNativeMcpServer = z.infer<typeof updateNativeMcpServerSchema>;
export type ConnectNativeMcpServer = z.infer<typeof connectNativeMcpServerSchema>;
