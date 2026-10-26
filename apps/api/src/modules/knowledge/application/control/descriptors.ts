import { KNOWLEDGE_CONNECTOR_DESCRIPTORS } from "@ngriffin_uk/polychat-ai-integrations";
import { listPageOf, type KnowledgeDescriptorSummary } from "@ngriffin_uk/polychat-schemas";

export function listKnowledgeDescriptors(provider?: string) {
  const descriptors: KnowledgeDescriptorSummary[] = KNOWLEDGE_CONNECTOR_DESCRIPTORS.filter(
    (descriptor) => !provider || descriptor.provider === provider,
  ).map((descriptor) => ({
    id: descriptor.id,
    provider: descriptor.provider,
    title: descriptor.title,
    description: descriptor.description,
    parameters: descriptor.parameters,
    incremental: Boolean(descriptor.list.updatedSince),
  }));

  return listPageOf(descriptors, (descriptor) => descriptor.id);
}
