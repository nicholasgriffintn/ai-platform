import {
  INCIDENT_BRIEF_RECIPE_ID,
  incidentBriefConfigurationSchema,
  type RecipeConnectorProvider,
  type IncidentBriefConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export const incidentBriefOperations = {
  pagerduty: [
    "PAGERDUTY_FETCH_INCIDENT_LIST",
    "PAGERDUTY_GET_ALERTS_BY_INCIDENT_ID",
    "PAGERDUTY_FETCH_RELATED_CHANGE_EVENTS_FOR_INCIDENT",
  ],
  sentry: ["SENTRY_LIST_AN_ORGANIZATIONS_ISSUES", "SENTRY_FETCH_ISSUE_EVENT_BY_ID"],
  github: ["GITHUB_LIST_DEPLOYMENTS", "GITHUB_GET_DEPLOYMENT_STATUS", "GITHUB_LIST_COMMITS"],
};

export function requireIncidentBriefConfiguration(
  configuration: unknown,
): IncidentBriefConfiguration {
  const parsed = incidentBriefConfigurationSchema.safeParse(configuration);

  if (!parsed.success) {
    throw new AssistantError(
      parsed.error.issues.map((issue) => issue.message).join("; "),
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parsed.data;
}

export function validateIncidentBriefConfiguration(
  recipeId: string,
  configuration: Record<string, unknown>,
) {
  if (
    recipeId === INCIDENT_BRIEF_RECIPE_ID &&
    Object.keys(configuration).some((key) => key !== "windowHours")
  ) {
    requireIncidentBriefConfiguration(configuration);
  }
}

export function requireIncidentBriefOperation(
  recipeId: string | undefined,
  configuration: unknown,
  provider: RecipeConnectorProvider,
  operation?: string,
): void {
  if (recipeId !== INCIDENT_BRIEF_RECIPE_ID) {
    return;
  }

  const mapping = requireIncidentBriefConfiguration(configuration);
  const mapped =
    provider === "pagerduty"
      ? Boolean(mapping.pagerDutyServiceId)
      : provider === "sentry"
        ? Boolean(mapping.sentryOrganisation && mapping.sentryProject)
        : provider === "github"
          ? Boolean(mapping.githubOwner && mapping.githubRepository)
          : false;
  const allowed =
    provider === "pagerduty"
      ? incidentBriefOperations.pagerduty
      : provider === "sentry"
        ? incidentBriefOperations.sentry
        : provider === "github"
          ? incidentBriefOperations.github
          : [];

  if (!mapped || (operation && !allowed.includes(operation))) {
    throw new AssistantError(
      "This incident brief has no mapping or read permission for that operation",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }
}

export function buildIncidentBriefContext(configuration: unknown, now = new Date()): string {
  const mapping = requireIncidentBriefConfiguration(configuration);
  const start = new Date(now.getTime() - mapping.windowHours * 3_600_000).toISOString();

  return [
    "Investigate the explicitly mapped resources below. Discover the current vendor schemas before forming arguments.",
    JSON.stringify(mapping),
    `Evidence window (UTC): ${start} to ${now.toISOString()}.`,
    "Use time and environment filters where the discovered operation supports them. Label unfiltered results and exclude out-of-window observations from the timeline.",
    "Read all mapped connected services. Report unavailable services and missing evidence without inventing results.",
    "Use search_documents for relevant project runbooks. Cite page revisions and freshness.",
    "Write a document in Files with write_document. Include impact, a timestamped evidence timeline with source links, recent changes, supported hypotheses, missing evidence and next checks.",
    "Keep observations separate from hypotheses. A correlated deployment is not proof of cause. Do not modify incidents, deployments or monitored services.",
  ].join("\n");
}
