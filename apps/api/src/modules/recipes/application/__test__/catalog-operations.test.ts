import {
  getConnectorOperationConfig,
  isConnectorOperationSupported,
} from "@ngriffin_uk/polychat-ai-integrations";
import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getAssistantRecipes } from "../catalog";

describe("recipe catalogue connector operations", () => {
  it("only names operations the connector catalogue knows", () => {
    const missing: string[] = [];

    for (const recipe of getAssistantRecipes()) {
      for (const integration of recipe.integrations) {
        const provider = recipeConnectorProviderSchema.safeParse(integration.providerId);

        for (const operation of integration.operationIds ?? []) {
          if (!provider.success || !isConnectorOperationSupported(provider.data, operation)) {
            missing.push(`${recipe.id}: ${integration.providerId}.${operation}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("gives read-only recipes read operations only", () => {
    const writes: string[] = [];

    for (const recipe of getAssistantRecipes()) {
      if (recipe.connectorPolicy?.access !== "read") {
        continue;
      }

      for (const integration of recipe.integrations) {
        const provider = recipeConnectorProviderSchema.safeParse(integration.providerId);

        for (const operation of integration.operationIds ?? []) {
          if (
            provider.success &&
            getConnectorOperationConfig(provider.data, operation)?.access !== "read"
          ) {
            writes.push(`${recipe.id}: ${integration.providerId}.${operation}`);
          }
        }
      }
    }

    expect(writes).toEqual([]);
  });
});
