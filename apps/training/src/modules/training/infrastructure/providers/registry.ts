import { ProviderLibrary } from "@ngriffin_uk/polychat-ai-providers";
import type { TrainingProviderId } from "@ngriffin_uk/polychat-schemas";

import type { TrainingProvider, TrainingProviderContext } from "../types/providers.js";
import { BedrockTrainingProvider } from "./BedrockTrainingProvider.js";
import {
  HuggingFaceTrainingProvider,
  withHuggingFaceCredentials,
} from "./HuggingFaceTrainingProvider.js";
import { SageMakerTrainingProvider } from "./SageMakerTrainingProvider.js";

type TrainingProviderMap = {
  training: TrainingProvider;
};

export const trainingProviderLibrary = new ProviderLibrary<
  TrainingProviderMap,
  TrainingProviderContext
>({
  bootstrappers: {
    training: [
      (registry) => {
        registry.register("training", {
          name: "aws-bedrock",
          lifecycle: "transient",
          metadata: { vendor: "AWS", categories: ["training"] },
          create: (context) => new BedrockTrainingProvider(context.env),
        });
        registry.register("training", {
          name: "aws-sagemaker",
          lifecycle: "transient",
          metadata: { vendor: "AWS", categories: ["training"] },
          create: (context) => new SageMakerTrainingProvider(context.env),
        });
        registry.register("training", {
          name: "huggingface",
          lifecycle: "transient",
          metadata: { vendor: "Hugging Face", categories: ["training"] },
          create: (context) =>
            new HuggingFaceTrainingProvider(
              withHuggingFaceCredentials(context.env, context.credentials),
            ),
        });
      },
    ],
  },
});

export function createTrainingProvider(
  provider: TrainingProviderId,
  context: TrainingProviderContext,
): TrainingProvider {
  return trainingProviderLibrary.resolve("training", provider, context);
}
