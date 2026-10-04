import { getConnectorProviderConfig } from "@ngriffin_uk/polychat-ai-integrations";
import { INCIDENT_BRIEF_RECIPE_ID } from "@ngriffin_uk/polychat-schemas";
import { expect, it } from "vitest";

import {
  buildIncidentBriefContext,
  incidentBriefOperations,
  requireIncidentBriefConfiguration,
  requireIncidentBriefOperation,
} from "~/modules/apps/application/recipes/incident-brief";
import { resolveProjectRecipeConnectorScope } from "~/modules/workspaces/application/projectRecipeConnectorScope";

const mapping = {
  serviceName: "API",
  environment: "production",
  windowHours: 24,
  pagerDutyServiceId: "P123",
  githubOwner: "example",
  githubRepository: "api",
};

it("requires complete mappings, a bounded window and read-only operations", () => {
  expect(() => requireIncidentBriefConfiguration({ ...mapping, windowHours: 169 })).toThrow();
  expect(() => requireIncidentBriefConfiguration({ ...mapping, sentryProject: "api" })).toThrow();
  expect(() =>
    requireIncidentBriefOperation(INCIDENT_BRIEF_RECIPE_ID, mapping, "sentry"),
  ).toThrow();
  expect(() =>
    requireIncidentBriefOperation(
      INCIDENT_BRIEF_RECIPE_ID,
      mapping,
      "pagerduty",
      "PAGERDUTY_UPDATE_INCIDENT",
    ),
  ).toThrow();
  expect(() =>
    requireIncidentBriefOperation(
      INCIDENT_BRIEF_RECIPE_ID,
      mapping,
      "github",
      "GITHUB_LIST_DEPLOYMENTS",
    ),
  ).not.toThrow();
  for (const [provider, operations] of Object.entries(incidentBriefOperations)) {
    for (const operation of operations) {
      expect(
        getConnectorProviderConfig(provider)?.operations.find((item) => item.id === operation)
          ?.access,
      ).toBe("read");
    }
  }

  expect(
    resolveProjectRecipeConnectorScope([
      { capability_id: INCIDENT_BRIEF_RECIPE_ID, kind: "recipe", excluded: 1 },
    ]).providers,
  ).toEqual([]);
});

it("bounds incident evidence to the requested UTC window", () => {
  const instructions = buildIncidentBriefContext(mapping, new Date("2026-10-04T12:00:00Z"));

  expect(instructions).toContain("2026-10-03T12:00:00.000Z to 2026-10-04T12:00:00.000Z");
});
