import { z } from "zod/v4";

export const shareAgentSchema = z.object({
  agent_id: z.string().meta({ description: "ID of the agent to share" }),
  name: z.string().meta({ description: "Public name for the shared agent" }),
  description: z
    .string()
    .optional()
    .meta({ description: "Public description for the shared agent" }),
  avatar_url: z
    .url()
    .optional()
    .meta({ description: "Avatar URL for the shared agent" }),
  category: z
    .string()
    .optional()
    .meta({ description: "Category for the shared agent" }),
  tags: z
    .array(z.string())
    .optional()
    .meta({ description: "Tags for the shared agent" }),
});

export const updateSharedAgentSchema = z.object({
  name: z
    .string()
    .optional()
    .meta({ description: "Updated name for the shared agent" }),
  description: z
    .string()
    .optional()
    .meta({ description: "Updated description for the shared agent" }),
  avatar_url: z
    .url()
    .optional()
    .meta({ description: "Updated avatar URL for the shared agent" }),
  category: z
    .string()
    .optional()
    .meta({ description: "Updated category for the shared agent" }),
  tags: z
    .array(z.string())
    .optional()
    .meta({ description: "Updated tags for the shared agent" }),
});

export const rateAgentSchema = z.object({
  rating: z
    .int()
    .min(1)
    .max(5)
    .meta({ description: "Rating from 1 to 5 stars" }),
  review: z.string().optional().meta({ description: "Optional review text" }),
});

export const sharedAgentFiltersSchema = z.object({
  category: z.string().optional().meta({ description: "Filter by category" }),
  tags: z.array(z.string()).optional().meta({ description: "Filter by tags" }),
  search: z.string().optional().meta({ description: "Search query" }),
  featured: z
    .boolean()
    .optional()
    .meta({ description: "Show only featured agents" }),
  limit: z
    .int()
    .positive()
    .max(100)
    .prefault(20)
    .optional()
    .meta({ description: "Number of results to return" }),
  offset: z
    .int()
    .min(0)
    .prefault(0)
    .optional()
    .meta({ description: "Number of results to skip" }),
  sort_by: z
    .enum(["recent", "popular", "rating"])
    .prefault("recent")
    .optional()
    .meta({ description: "Sort order" }),
});

export const featuredAgentsSchema = z.object({
  limit: z
    .int()
    .positive()
    .max(50)
    .prefault(10)
    .optional()
    .meta({ description: "Number of featured agents to return" }),
});

export const agentRatingsSchema = z.object({
  limit: z
    .int()
    .positive()
    .max(50)
    .prefault(10)
    .optional()
    .meta({ description: "Number of ratings to return" }),
});
