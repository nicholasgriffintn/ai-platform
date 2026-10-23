import z from "zod/v4";

export const JSON_RPC_ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export const jsonRpcPayloadSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.record(z.string(), z.unknown())).min(1).max(50),
]);

export const jsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.number(), z.string(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({ code: z.number().int(), message: z.string(), data: z.unknown().optional() })
    .optional(),
});

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcPayload = z.infer<typeof jsonRpcPayloadSchema>;
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;
