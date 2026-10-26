import type { KnowledgeBaseConnectorProvider } from "@ngriffin_uk/polychat-ai-integrations";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BedrockKnowledgeBaseProvider } from "./providers/BedrockKnowledgeBaseProvider";
import { CloudflareAiSearchKnowledgeProvider } from "./providers/CloudflareAiSearchKnowledgeProvider";
import type { KnowledgeBaseProvider } from "./types";

export type { KnowledgeBaseHit, KnowledgeBaseProvider } from "./types";

export function createKnowledgeBaseProvider(
  providerId: KnowledgeBaseConnectorProvider,
  credential: string,
): KnowledgeBaseProvider {
  const parts = credential.split("|");

  if (providerId === "cloudflare_ai_search") {
    const [token, accountId, instance] = parts;

    if (token && accountId && instance) {
      return new CloudflareAiSearchKnowledgeProvider({ token, accountId, instance });
    }
  }

  if (providerId === "bedrock_knowledge_base") {
    const [secretAccessKey, accessKeyId, knowledgeBaseId, region] = parts;

    if (secretAccessKey && accessKeyId && knowledgeBaseId && region) {
      return new BedrockKnowledgeBaseProvider({
        secretAccessKey,
        accessKeyId,
        knowledgeBaseId,
        region,
      });
    }
  }

  throw new AssistantError(
    "Reconnect this knowledge base with every field filled in",
    ErrorType.CONFIGURATION_ERROR,
    400,
  );
}
