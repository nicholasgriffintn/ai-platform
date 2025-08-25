import type { EmbeddingProvider, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  BedrockEmbeddingProvider,
  type BedrockEmbeddingProviderConfig,
} from "./bedrock";
import {
  MarengoEmbeddingProvider,
  type MarengoEmbeddingProviderConfig,
} from "./marengo";
import {
  VectorizeEmbeddingProvider,
  type VectorizeEmbeddingProviderConfig,
} from "./vectorize";

// biome-ignore lint/complexity/noStaticOnlyClass: I prefer this pattern
export class EmbeddingProviderFactory {
  static getProvider(
    type: string,
    config:
      | VectorizeEmbeddingProviderConfig
      | BedrockEmbeddingProviderConfig
      | MarengoEmbeddingProviderConfig,
    env: IEnv,
    user?: IUser,
  ): EmbeddingProvider {
    switch (type) {
      case "bedrock":
        if (!("knowledgeBaseId" in config)) {
          throw new AssistantError(
            "Invalid config for Bedrock provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        return new BedrockEmbeddingProvider(config, env, user);
      case "vectorize":
        if (!("ai" in config)) {
          throw new AssistantError(
            "Invalid config for Vectorize provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        return new VectorizeEmbeddingProvider(config);
      case "marengo":
        if (!("vector_db" in config)) {
          throw new AssistantError(
            "Invalid config for Marengo provider",
            ErrorType.CONFIGURATION_ERROR,
          );
        }
        return new MarengoEmbeddingProvider(config, env, user);
      default:
        throw new AssistantError(
          `Unsupported embedding provider: ${type}`,
          ErrorType.PARAMS_ERROR,
        );
    }
  }
}
