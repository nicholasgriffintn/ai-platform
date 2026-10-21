import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import { listSchema } from "./platform/list.js";

export const HOSTED_MCP_APPROVAL_TOOL_NAME = "hosted_mcp_approval" as const;

export const mcpHttpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .pipe(z.url())
  .refine(
    (value) => {
      const url = new URL(value);

      return url.protocol === "https:" && !url.username && !url.password;
    },
    {
      message: "MCP server URLs must use HTTPS without embedded credentials",
    },
  );

export const mcpAllowedToolsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9_.:/-]+$/),
  )
  .min(1)
  .max(100);

export const mcpCredentialEndpointSchema = mcpHttpsUrlSchema.refine(
  (value) => {
    const url = new URL(value);

    return !isPrivateHostname(url.hostname) && !url.search && !url.hash;
  },
  { message: "Use a reachable HTTPS gateway without query credentials for authenticated MCP" },
);

export const MCP_CREDENTIAL_RECIPIENTS = ["openai", "polychat"] as const;

export const mcpCredentialRecipientSchema = z
  .enum(MCP_CREDENTIAL_RECIPIENTS)
  .describe(
    "Who receives the credential: OpenAI's hosted MCP tool, or Polychat's own MCP gateway, which works with any model.",
  );

export type McpCredentialRecipient = z.infer<typeof mcpCredentialRecipientSchema>;

export const mcpConnectionAuthMethodSchema = z.enum(["token", "oauth"]);

export const mcpConnectionInputSchema = z
  .object({
    credentialRecipient: mcpCredentialRecipientSchema,
    label: z.string().trim().min(1).max(80),
    url: mcpCredentialEndpointSchema,
    token: z
      .string()
      .trim()
      .min(1)
      .max(8192)
      .regex(/^[A-Za-z0-9._~+/-]+=*$/),
    allowedTools: mcpAllowedToolsSchema,
  })
  .strict();

export const mcpConnectionSchema = z
  .object({
    credentialRecipient: mcpCredentialRecipientSchema,
    authMethod: mcpConnectionAuthMethodSchema.default("token"),
    id: z.string(),
    label: z.string(),
    url: mcpCredentialEndpointSchema,
    allowedTools: mcpAllowedToolsSchema,
    createdAt: z.string(),
  })
  .strict();

export const mcpConnectionListSchema = listSchema(mcpConnectionSchema);
export type McpConnectionInput = z.infer<typeof mcpConnectionInputSchema>;
export type McpConnection = z.infer<typeof mcpConnectionSchema>;

export const mcpOAuthStartInputSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    url: mcpCredentialEndpointSchema,
    allowedTools: mcpAllowedToolsSchema,
  })
  .strict();

export type McpOAuthStartInput = z.infer<typeof mcpOAuthStartInputSchema>;

export const mcpOAuthStartResponseSchema = z.object({ authorizationUrl: z.url() });

export const mcpOAuthCallbackQuerySchema = z.object({
  state: z.string().min(1).max(200),
  code: z.string().min(1).max(4096).optional(),
  error: z.string().max(200).optional(),
});

export const mcpToolServerConfigurationSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    url: mcpHttpsUrlSchema,
    credentialConnectionId: z.string().trim().min(1).max(100).optional(),
    allowedTools: mcpAllowedToolsSchema.optional(),
  })
  .strict();

export const MCP_LIST_TOOLS_NAME = "mcp_list_tools";
export const MCP_CALL_TOOL_NAME = "mcp_call_tool";

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const MCP_APP_RENDERER = "mcp_app";
export const MCP_APP_PROTOCOL_VERSION = "2025-06-18";

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export const MCP_APP_MAX_HTML_BYTES = 1024 * 1024;

const domainListSchema = z.array(z.string().trim().min(1).max(253)).max(32);

export const mcpAppCspSchema = z
  .object({
    connectDomains: domainListSchema.optional(),
    resourceDomains: domainListSchema.optional(),
    frameDomains: domainListSchema.optional(),
    baseUriDomains: domainListSchema.optional(),
  })
  .partial();

export const mcpAppPermissionsSchema = z
  .object({
    camera: z.object({}).optional(),
    microphone: z.object({}).optional(),
    geolocation: z.object({}).optional(),
    clipboardWrite: z.object({}).optional(),
  })
  .partial();

export const mcpAppUiMetaSchema = z
  .object({
    csp: mcpAppCspSchema.optional(),
    permissions: mcpAppPermissionsSchema.optional(),
    prefersBorder: z.boolean().optional(),
    domain: z.string().optional(),
  })
  .partial();

export const mcpAppCallToolResultSchema = z.object({
  content: z.array(z.object({ type: z.string() }).passthrough()).default([]),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

export const mcpAppViewSchema = z.object({
  integration: z.string().min(1),
  tool: z.string().min(1),
  uri: z.string().min(1),
  html: z.string().min(1).max(MCP_APP_MAX_HTML_BYTES),
  ui: mcpAppUiMetaSchema,
  arguments: z.record(z.string(), z.unknown()),
  result: mcpAppCallToolResultSchema,
});

export const mcpAppToolCallRequestSchema = z.object({
  integration: z.string().trim().min(1).max(80),
  tool: z.string().trim().min(1).max(200),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export type McpAppCsp = z.infer<typeof mcpAppCspSchema>;
export type McpAppPermissions = z.infer<typeof mcpAppPermissionsSchema>;
export type McpAppUiMeta = z.infer<typeof mcpAppUiMetaSchema>;
export type McpAppCallToolResult = z.infer<typeof mcpAppCallToolResultSchema>;
export type McpAppView = z.infer<typeof mcpAppViewSchema>;
export type McpAppToolCallRequest = z.infer<typeof mcpAppToolCallRequestSchema>;

export function normaliseMcpServerLabel(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
}

export function getMcpServerDefaultLabel(url: string): string {
  try {
    return normaliseMcpServerLabel(new URL(url).hostname);
  } catch {
    return "";
  }
}

export function getUniqueMcpServerLabel(base: string, index: number, used: Set<string>): string {
  let label = base || `server_${index + 1}`;
  let suffix = index + 1;

  while (used.has(label)) {
    label = `${base.slice(0, 70)}_${suffix}`;
    suffix += 1;
  }

  used.add(label);

  return label;
}

export const MCP_SERVER_PRESETS = [
  {
    label: "Inspo",
    url: "https://inspomcp.dev/api/mcp?profile=lite&images=thumbs",
    description:
      "Captures of real production websites, palettes and reference components to design from.",
  },
] as const;

export type McpServerPreset = (typeof MCP_SERVER_PRESETS)[number];
