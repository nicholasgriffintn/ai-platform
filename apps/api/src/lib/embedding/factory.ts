import type { EmbeddingProvider } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import {
  BedrockEmbeddingProvider,
  type BedrockEmbeddingProviderConfig,
} from "./bedrock";
import {
  VectorizeEmbeddingProvider,
  type VectorizeEmbeddingProviderConfig,
} from "./vectorize";

// biome-ignore lint/complexity/noStaticOnlyClass: I prefer this pattern
export class EmbeddingProviderFactory {
  static getProvider(
    type: string,
    config: VectorizeEmbeddingProviderConfig | BedrockEmbeddingProviderConfig,
  ): EmbeddingProvider {
    switch (type) {
      case "bedrock":
        if (!("knowledgeBaseId" in config)) {
          throw new AssistantError(
            "Invalid config for Bedrock provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        return new BedrockEmbeddingProvider(config);
      case "vectorize":
        if (!("ai" in config)) {
          throw new AssistantError(
            "Invalid config for Vectorize provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        return new VectorizeEmbeddingProvider(config);
      default:
        throw new AssistantError(
          `Unsupported embedding provider: ${type}`,
          ErrorType.PARAMS_ERROR,
        );
    }
  }
}
