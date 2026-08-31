import {
  realtimeLiveProviderDescriptorSchema,
  type ModelConfig,
  type RealtimeLiveProviderCatalogueItem,
  type RealtimeLiveProviderDescriptor,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { providerLibrary } from "~/lib/providers/library";
import { hasUserProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { listModels } from "~/services/models";

function hasConfiguredEnvironmentVariable(env: object, name: string): boolean {
  const value = Reflect.get(env, name);

  return typeof value === "string" && value.trim().length > 0;
}

function hasAccessibleDefaultModel(
  models: ModelConfig,
  descriptor: RealtimeLiveProviderDescriptor,
): boolean {
  return Object.entries(models).some(
    ([modelId, model]) =>
      modelId === descriptor.defaultModelId ||
      model.matchingModel === descriptor.defaultModelId ||
      model.name === descriptor.defaultModelId,
  );
}

export function resolveRealtimeProviderReadiness({
  descriptor,
  hasAccessibleModel,
  hasConfiguration,
}: {
  descriptor: RealtimeLiveProviderDescriptor;
  hasAccessibleModel: boolean;
  hasConfiguration: boolean;
}): Pick<RealtimeLiveProviderCatalogueItem, "available" | "readiness" | "availabilityReason"> {
  if (!hasAccessibleModel) {
    return {
      available: false,
      readiness: "unavailable",
      availabilityReason: `${descriptor.shortLabel}'s default realtime model is not available for this account.`,
    };
  }

  if (hasConfiguration) {
    return {
      available: true,
      readiness: "ready",
      availabilityReason: `${descriptor.shortLabel} is ready.`,
    };
  }

  return {
    available: true,
    readiness: "setup_required",
    availabilityReason: `Configure a ${descriptor.shortLabel} API key in provider settings.`,
  };
}

export async function listRealtimeLiveProviders(
  context: ServiceContext,
): Promise<RealtimeLiveProviderCatalogueItem[]> {
  const user = context.requireUser();
  const models = await listModels(context.env, user.id);
  const logger = context.getLogger({ prefix: "realtime-provider-catalogue" });
  const providers = await Promise.all(
    providerLibrary.list("realtime").map(async ({ name }) => {
      let provider;

      try {
        provider = providerLibrary.realtime(name, {
          env: context.env,
          user,
          serviceContext: context,
        });
      } catch (error) {
        logger.error("Failed to construct realtime provider", { provider: name, error });

        return null;
      }

      const descriptorResult = realtimeLiveProviderDescriptorSchema.safeParse(provider.descriptor);

      if (!descriptorResult.success || descriptorResult.data.id !== name) {
        logger.error("Realtime provider registration has an invalid descriptor", {
          provider: name,
          issues: descriptorResult.success ? undefined : descriptorResult.error.issues,
        });

        return null;
      }

      try {
        const hasPlatformConfiguration =
          provider.configuration.environmentVariables.length > 0 &&
          provider.configuration.environmentVariables.every((variable) =>
            hasConfiguredEnvironmentVariable(context.env, variable),
          );
        const hasUserConfiguration =
          !hasPlatformConfiguration &&
          provider.configuration.acceptsUserApiKey &&
          (await hasUserProviderApiKey({
            env: context.env,
            user,
            providerName: descriptorResult.data.id,
          }));
        const readiness = resolveRealtimeProviderReadiness({
          descriptor: descriptorResult.data,
          hasAccessibleModel: hasAccessibleDefaultModel(models, descriptorResult.data),
          hasConfiguration: hasPlatformConfiguration || hasUserConfiguration,
        });

        return { ...descriptorResult.data, ...readiness };
      } catch (error) {
        logger.error("Failed to resolve realtime provider readiness", {
          provider: name,
          error,
        });

        const unavailableProvider: RealtimeLiveProviderCatalogueItem = {
          ...descriptorResult.data,
          available: false,
          readiness: "unavailable",
          availabilityReason: `${descriptorResult.data.shortLabel} readiness could not be determined.`,
        };

        return unavailableProvider;
      }
    }),
  );

  const availableProviders = providers.filter(
    (provider): provider is RealtimeLiveProviderCatalogueItem => provider !== null,
  );

  return availableProviders.sort((left, right) => left.order - right.order);
}
