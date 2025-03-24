import { z } from "zod";
import "zod-openapi/extend";

export const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  name: z.string().optional(),
  tool_calls: z.array(z.record(z.any())).optional(),
  parts: z.array(z.object({ text: z.string() })).optional(),
  content: z.string(),
  status: z.string().optional(),
  data: z.record(z.any()).optional(),
  model: z.string().optional(),
  log_id: z.string().optional(),
  citations: z.array(z.string()).optional(),
  app: z.string().optional(),
  mode: z.enum(["chat", "tool"]).optional(),
  id: z.string().optional(),
  timestamp: z.number().optional(),
  platform: z.enum(["web", "mobile", "api"]).optional(),
});
