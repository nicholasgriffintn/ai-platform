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

export const mcpToolServerConfigurationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: mcpHttpsUrlSchema,
});

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
