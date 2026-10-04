import { expect, it } from "vitest";

import { getRecipeById } from "../catalog";
import {
  buildRecipeInvocationContext,
  getRecipeConnectorParameters,
  requireRecipeConnectorAccess,
  validateRecipeConfiguration,
} from "../configuration";

const definition = getRecipeById("service-incident-brief");

if (!definition) {
  throw new Error("Missing recipe fixture");
}

const recipe = { ...definition, id: "another-investigation" };
const mapping = {
  serviceName: "API",
  environment: "production",
  windowHours: 24,
  pagerDutyServiceId: "P123",
  githubOwner: "example",
  githubRepository: "api",
};

it("enforces declared configuration bounds, complete resource mappings and operation permissions independently of recipe identity", () => {
  expect(() => validateRecipeConfiguration(recipe, { ...mapping, windowHours: 169 })).toThrow();
  expect(() => validateRecipeConfiguration(recipe, { ...mapping, sentryProject: "api" })).toThrow();
  expect(() => requireRecipeConnectorAccess(recipe, mapping, "sentry")).toThrow();
  expect(() =>
    requireRecipeConnectorAccess(recipe, mapping, "pagerduty", "PAGERDUTY_UPDATE_INCIDENT"),
  ).toThrow();
  expect(() =>
    requireRecipeConnectorAccess(recipe, mapping, "github", "GITHUB_LIST_DEPLOYMENTS"),
  ).not.toThrow();
});

it("keeps prompt configuration out of vendor arguments and bounds evidence to the configured UTC window", () => {
  expect(getRecipeConnectorParameters(recipe, { repository: "api" }, mapping)).toEqual({
    repository: "api",
  });
  expect(buildRecipeInvocationContext(recipe, mapping, new Date("2026-10-04T12:00:00Z"))).toContain(
    "2026-10-03T12:00:00.000Z to 2026-10-04T12:00:00.000Z",
  );
});
