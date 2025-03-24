import z from "zod";
import "zod-openapi/extend";

export const statusResponseSchema = z.object({
  status: z.string().openapi({ example: "ok" }),
});

export const metricsParamsSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  limit: z.string().optional(),
  interval: z.string().optional(),
  timeframe: z.string().optional(),
});
