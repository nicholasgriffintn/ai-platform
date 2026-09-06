import z from "zod/v4";

import {
  modelToolDefinitionSchema,
  projectExperienceDefinitionSchema,
  recipeCategorySchema,
  recipeKindSchema,
} from "./apps";
import { toolSchema } from "./tools";

export const recipeCatalogueSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  kind: recipeKindSchema,
  category: recipeCategorySchema,
  featured: z.boolean(),
  integrations: z.array(
    z.object({
      id: z.string(),
      providerId: z.string(),
      name: z.string(),
    }),
  ),
});

export const publicCapabilityCatalogueResponseSchema = z.object({
  experiences: z.array(projectExperienceDefinitionSchema),
  modelTools: z.array(modelToolDefinitionSchema),
  tools: z.array(toolSchema),
  recipes: z.array(recipeCatalogueSummarySchema),
});

export type RecipeCatalogueSummary = z.infer<typeof recipeCatalogueSummarySchema>;
export type PublicCapabilityCatalogueResponse = z.infer<
  typeof publicCapabilityCatalogueResponseSchema
>;
