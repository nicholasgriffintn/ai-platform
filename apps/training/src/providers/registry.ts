import { ProviderLibrary } from "@ngriffin_uk/polychat-ai-providers";
import type { TrainingProviderId } from "@ngriffin_uk/polychat-schemas";

import type { TrainingProvider, TrainingProviderContext } from "../types/providers.js";
import { BedrockTrainingProvider } from "./BedrockTrainingProvider.js";
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
