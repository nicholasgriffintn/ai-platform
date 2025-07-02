import { z } from "zod";
import "zod-openapi/extend";

export const shareAgentSchema = z.object({
  agent_id: z.string().openapi({ description: "ID of the agent to share" }),
  name: z.string().openapi({ description: "Public name for the shared agent" }),
  description: z
    .string()
    .optional()
    .openapi({ description: "Public description for the shared agent" }),
  avatar_url: z
    .string()
    .url()
    .optional()
    .openapi({ description: "Avatar URL for the shared agent" }),
  category: z
    .string()
    .optional()
    .openapi({ description: "Category for the shared agent" }),
  tags: z
    .array(z.string())
    .optional()
    .openapi({ description: "Tags for the shared agent" }),
});

export const updateSharedAgentSchema = z.object({
  name: z
    .string()
    .optional()
    .openapi({ description: "Updated name for the shared agent" }),
  description: z
    .string()
    .optional()
    .openapi({ description: "Updated description for the shared agent" }),
  avatar_url: z
    .string()
    .url()
    .optional()
    .openapi({ description: "Updated avatar URL for the shared agent" }),
  category: z
    .string()
    .optional()
    .openapi({ description: "Updated category for the shared agent" }),
  tags: z
    .array(z.string())
    .optional()
    .openapi({ description: "Updated tags for the shared agent" }),
});

export const rateAgentSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1)
    .max(5)
    .openapi({ description: "Rating from 1 to 5 stars" }),
  review: z
    .string()
    .optional()
    .openapi({ description: "Optional review text" }),
});

export const sharedAgentFiltersSchema = z.object({
  category: z
    .string()
    .optional()
    .openapi({ description: "Filter by category" }),
  tags: z
    .array(z.string())
    .optional()
    .openapi({ description: "Filter by tags" }),
  search: z.string().optional().openapi({ description: "Search query" }),
  featured: z
    .boolean()
    .optional()
    .openapi({ description: "Show only featured agents" }),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .optional()
    .openapi({ description: "Number of results to return" }),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .optional()
    .openapi({ description: "Number of results to skip" }),
  sort_by: z
    .enum(["recent", "popular", "rating"])
    .default("recent")
    .optional()
    .openapi({ description: "Sort order" }),
});

export const featuredAgentsSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .optional()
    .openapi({ description: "Number of featured agents to return" }),
});

export const agentRatingsSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(10)
    .optional()
    .openapi({ description: "Number of ratings to return" }),
});
