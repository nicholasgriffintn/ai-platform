import z from "zod/v4";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export const jsonRpcErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

export const jsonRpcResponseSchema = z.object({
  jsonrpc: z.string().optional(),
  id: z.union([z.number(), z.string()]).nullable().optional(),
  result: z.unknown().optional(),
  error: jsonRpcErrorSchema.optional(),
});

export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;

export const mcpToolAnnotationsSchema = z
  .object({
    title: z.string().optional(),
    readOnlyHint: z.boolean().optional(),
    destructiveHint: z.boolean().optional(),
    idempotentHint: z.boolean().optional(),
    openWorldHint: z.boolean().optional(),
  })
  .passthrough();

export const mcpToolSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  annotations: mcpToolAnnotationsSchema.optional(),
});

export type McpTool = z.infer<typeof mcpToolSchema>;

export const mcpToolListResultSchema = z.object({
  tools: z.array(z.unknown()).default([]),
  nextCursor: z.string().optional(),
});

export const mcpContentBlockSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

export const mcpToolCallResultSchema = z.object({
  content: z.array(mcpContentBlockSchema).default([]),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

export type McpToolCallResult = z.infer<typeof mcpToolCallResultSchema>;
