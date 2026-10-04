import { configuredComposioToolkits } from "@ngriffin_uk/polychat-ai-integrations";

import { RECIPE_CONNECTOR_TOOL, type CatalogRecipe } from "./shared";

export const platformKnowledgeRecipes: CatalogRecipe[] = [
  {
    id: "confluence-project-knowledge",
    title: "Confluence Project Knowledge",
    summary: "Keep selected Confluence pages searchable in a project.",
    description:
      "Sync selected published pages through the connected account, retain page versions and freshness, and archive pages explicitly marked deleted or archived.",
    kind: "integrate",
    category: "Developer",
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL, "configure_knowledge_sync", "search_documents"],
    integrations: [
      {
        id: "confluence",
        providerId: "confluence",
        name: "Confluence",
        description: "Selected project runbooks and documentation",
        requiresConnection: true,
        operationIds: ["CONFLUENCE_GET_PAGE_BY_ID"],
        knowledgeAdapterId: "confluence-page",
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Set up knowledge sync",
        description: "Choose a connected account, published pages, a project and refresh interval.",
      },
    ],
    actions: [
      "Discover the page read schema",
      "Save an explicit selected-page sync",
      "Search current project passages with citations",
    ],
    setupPrompt:
      "Set up Confluence Project Knowledge. Ask which published page IDs to share with this project and how often to refresh (5 minutes to one day). Discover CONFLUENCE_GET_PAGE_BY_ID with use_recipe_connector and read the selected pages including storage body and version using its actual schema. Call configure_knowledge_sync with this recipe ID, the confluence integration ID, discovery.connectionReferenceId as connectionId, and the tested read parameters for each resourceId. Never guess vendor parameter names or include credentials in parameters. Explain that page text is copied into project Files and available to project members. Freshness and pause/refresh controls are in Files.",
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
