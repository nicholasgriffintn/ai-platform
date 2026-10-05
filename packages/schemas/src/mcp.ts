import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

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

export const mcpConnectionInputSchema = z
  .object({
    credentialRecipient: z.literal("openai"),
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
    credentialRecipient: z.literal("openai"),
    id: z.string(),
    label: z.string(),
    url: mcpCredentialEndpointSchema,
    allowedTools: mcpAllowedToolsSchema,
    createdAt: z.string(),
  })
  .strict();

export const mcpConnectionListSchema = z.object({ connections: z.array(mcpConnectionSchema) });
export type McpConnectionInput = z.infer<typeof mcpConnectionInputSchema>;
export type McpConnection = z.infer<typeof mcpConnectionSchema>;

export const mcpToolServerConfigurationSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    url: mcpHttpsUrlSchema,
    credentialConnectionId: z.string().trim().min(1).max(100).optional(),
    allowedTools: mcpAllowedToolsSchema.optional(),
  })
  .strict();

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
