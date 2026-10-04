import z from "zod/v4";

export const knowledgeConnectorCapabilitySchema = z.object({
  rootLabel: z.string().min(1),
  rootPlaceholder: z.string(),
  contentDescription: z.string(),
});

export type KnowledgeConnectorCapability = z.infer<typeof knowledgeConnectorCapabilitySchema>;
