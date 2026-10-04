import {
  configuredComposioToolkits,
  connectorProviders,
  connectorOperationRequiresApproval,
} from "@ngriffin_uk/polychat-ai-integrations";
import type { AssistantRecipe } from "@ngriffin_uk/polychat-schemas";

import { RECIPE_CONNECTOR_TOOL, type CatalogRecipe } from "./shared";

function buildKnowledgeIntegrations(): AssistantRecipe["integrations"] {
  const integrations: AssistantRecipe["integrations"] = [];

  for (const provider of connectorProviders) {
    if (provider.auth.authType !== "composio") {
      continue;
    }

    const operationIds: string[] = [];

    for (const operation of provider.operations) {
      if (
        operation.access === "read" &&
        !connectorOperationRequiresApproval(provider.id, operation.id)
      ) {
        operationIds.push(operation.id);
      }
    }

    if (operationIds.length > 0) {
      integrations.push({
        id: provider.id,
        providerId: provider.id,
        name: provider.name,
        description: provider.description,
        requiresConnection: true,
        connectionGroup: "knowledge",
        operationIds,
      });
    }
  }

  return integrations;
}

export const platformKnowledgeRecipes: CatalogRecipe[] = [
  {
    id: "project-knowledge",
    title: "Project Knowledge",
    summary: "Keep selected documents from connected services searchable in a project.",
    description:
      "Choose connected services, read operations and document mappings. Refresh selected resources into project Files with revisions, freshness and explicit archive states.",
    kind: "integrate",
    category: "Developer",
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL, "configure_knowledge_sync", "search_documents"],
    connectorPolicy: { access: "read", parameters: "explicit" },
    integrations: buildKnowledgeIntegrations(),
    triggers: [
      {
        type: "message",
        label: "Set up knowledge sync",
        description: "Choose a connected account, documents, a project and refresh interval.",
      },
    ],
    actions: [
      "Discover the document read schema",
      "Save an explicit selected-resource sync",
      "Search current project passages with citations",
    ],
    setupPrompt:
      "Set up Project Knowledge. Ask which connected service and documents to share with this project and how often to refresh (5 minutes to one day). Discover authorised read operations with use_recipe_connector, read the selected resources and inspect the returned fields before saving the document mappings with configure_knowledge_sync. Use the discovered connection reference and tested read parameters. Never guess vendor field or parameter names or include credentials. Explain that document text is copied into project Files and available to project members. Freshness and pause/refresh controls are in Files.",
  },
  {
    id: "service-incident-brief",
    title: "Service Incident Brief",
    summary: "Correlate incidents, errors and recent deployments for one mapped service.",
    description:
      "Collect read-only evidence from mapped PagerDuty, Sentry and GitHub resources over a bounded UTC window and save a brief with citations and missing evidence.",
    kind: "integrate",
    category: "Developer",
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL, "search_documents", "write_document"],
    connectorPolicy: { access: "read", requireConfiguredIntegration: true, parameters: "explicit" },
    invocationContext: {
      windowHoursKey: "windowHours",
      instructions:
        "Investigate the saved service and environment using only explicitly mapped resources. Discover current vendor schemas before forming arguments. Use time and environment filters where supported; label unfiltered results and exclude out-of-window observations. Read every mapped connected service and report missing evidence. Search project runbooks with citations, revisions and freshness. Save a document in Files with impact, a timestamped timeline, recent changes, supported hypotheses, missing evidence and next checks. Keep observations separate from hypotheses; a correlated deployment does not prove cause.",
    },
    integrations: [
      {
        id: "pagerduty",
        providerId: "pagerduty",
        name: configuredComposioToolkits.pagerduty.name,
        description: configuredComposioToolkits.pagerduty.description,
        requiresConnection: true,
        connectionGroup: "evidence",
        configurationKeys: ["pagerDutyServiceId"],
        operationIds: [
          "PAGERDUTY_FETCH_INCIDENT_LIST",
          "PAGERDUTY_GET_ALERTS_BY_INCIDENT_ID",
          "PAGERDUTY_FETCH_RELATED_CHANGE_EVENTS_FOR_INCIDENT",
        ],
      },
      {
        id: "sentry",
        providerId: "sentry",
        name: configuredComposioToolkits.sentry.name,
        description: configuredComposioToolkits.sentry.description,
        requiresConnection: true,
        connectionGroup: "evidence",
        configurationKeys: ["sentryOrganisation", "sentryProject"],
        operationIds: ["SENTRY_LIST_AN_ORGANIZATIONS_ISSUES", "SENTRY_FETCH_ISSUE_EVENT_BY_ID"],
      },
      {
        id: "github",
        providerId: "github",
        name: configuredComposioToolkits.github.name,
        description: configuredComposioToolkits.github.description,
        requiresConnection: true,
        connectionGroup: "evidence",
        configurationKeys: ["githubOwner", "githubRepository"],
        operationIds: [
          "GITHUB_LIST_DEPLOYMENTS",
          "GITHUB_GET_DEPLOYMENT_STATUS",
          "GITHUB_LIST_COMMITS",
        ],
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Investigate service",
        description: "Build a brief for the saved service mapping.",
      },
    ],
    actions: [
      "Read all mapped connected evidence sources",
      "Correlate the evidence with project runbooks",
      "Save a cited incident brief in Files",
    ],
    setupPrompt:
      "Set up Service Incident Brief. Save an explicit service name, environment and 1–168 hour window. Ask for the PagerDuty service ID, Sentry organisation and project, and GitHub owner and repository for each service to use. At least one complete mapping is required. Never infer identifiers from names. Use configure_recipe to save the mapping. Discover tool schemas for exact arguments before any reads. The recipe is read-only and writes its report through write_document in Files.",
    configurationFields: [
      { key: "serviceName", label: "Service", type: "text", required: true, maximum: 120 },
      { key: "environment", label: "Environment", type: "text", required: true, maximum: 80 },
      {
        key: "windowHours",
        label: "Evidence window in hours",
        type: "number",
        required: true,
        defaultValue: 24,
        minimum: 1,
        maximum: 168,
        integer: true,
      },
      { key: "pagerDutyServiceId", label: "PagerDuty service ID", type: "text", maximum: 200 },
      { key: "sentryOrganisation", label: "Sentry organisation", type: "text", maximum: 200 },
      { key: "sentryProject", label: "Sentry project", type: "text", maximum: 200 },
      {
        key: "githubOwner",
        label: "GitHub owner",
        type: "text",
        maximum: 100,
        pattern: "^[A-Za-z0-9-]+$",
      },
      {
        key: "githubRepository",
        label: "GitHub repository",
        type: "text",
        maximum: 100,
        pattern: "^[A-Za-z0-9_.-]+$",
      },
    ],
  },
];
