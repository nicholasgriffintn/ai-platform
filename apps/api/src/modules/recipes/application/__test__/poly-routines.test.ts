import { getConnectorOperationConfig } from "@ngriffin_uk/polychat-ai-integrations";
import {
  POLY_ROUTINE_TEMPLATES,
  polyRoutineCron,
  recipeConnectorProviderSchema,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getRecipeById } from "../catalog";

describe("Poly's routine templates", () => {
  it("stays within reads and drafts, and never runs past asking before a write", () => {
    expect(POLY_ROUTINE_TEMPLATES).toHaveLength(5);

    for (const template of POLY_ROUTINE_TEMPLATES) {
      const recipe = getRecipeById(template.id);

      expect(recipe?.autonomyCeiling).toBe("assistant");
      expect(recipe?.maxSteps).toBeGreaterThan(0);

      for (const integration of recipe?.integrations ?? []) {
        const provider = recipeConnectorProviderSchema.parse(integration.providerId);

        for (const operation of integration.operationIds ?? []) {
          const config = getConnectorOperationConfig(provider, operation);

          expect(config?.destructive).not.toBe(true);
          expect(operation).not.toMatch(/SEND|DELETE|REPLY/u);

          if (recipe?.readOnly) {
            expect(config?.access).toBe("read");
          }
        }
      }
    }
  });

  it("runs at the chosen time on the template's days", () => {
    const [weekdays] = POLY_ROUTINE_TEMPLATES;
    const friday = POLY_ROUTINE_TEMPLATES.find((template) => template.weekdays === "5");

    expect(polyRoutineCron(weekdays)).toBe("30 7 * * 1-5");
    expect(polyRoutineCron(weekdays, "09:05")).toBe("5 9 * * 1-5");
    expect(friday && polyRoutineCron(friday)).toBe("30 16 * * 5");
  });
});
