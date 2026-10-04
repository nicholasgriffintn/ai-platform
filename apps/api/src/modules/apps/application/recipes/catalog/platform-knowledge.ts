import { configuredComposioToolkits } from "@ngriffin_uk/polychat-ai-integrations";
import {
  CONFLUENCE_KNOWLEDGE_RECIPE_ID,
  CONFLUENCE_PAGE_READ_OPERATION,
  INCIDENT_BRIEF_RECIPE_ID,
} from "@ngriffin_uk/polychat-schemas";

import { incidentBriefOperations } from "../incident-brief";
import { RECIPE_CONNECTOR_TOOL, type CatalogRecipe } from "./shared";

export const platformKnowledgeRecipes: CatalogRecipe[] = [
  {
    id: CONFLUENCE_KNOWLEDGE_RECIPE_ID,
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
        operationIds: [CONFLUENCE_PAGE_READ_OPERATION],
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
      "Set up Confluence Project Knowledge. Ask which published page IDs to share with this project and how often to refresh (5 minutes to one day). Discover CONFLUENCE_GET_PAGE_BY_ID with use_recipe_connector and read the selected pages including storage body and version using its actual schema. Use discovery.connectionReferenceId as connectionId and validated page read parameters to call configure_knowledge_sync. Never guess vendor parameter names or include credentials in parameters. Explain that page text is copied into project Files and available to project members. Freshness and pause/refresh controls are in Files.",
  },
  {
    id: INCIDENT_BRIEF_RECIPE_ID,
    title: "Service Incident Brief",
    summary: "Correlate incidents, errors and recent deployments for one mapped service.",
    description:
      "Collect read-only evidence from mapped PagerDuty, Sentry and GitHub resources over a bounded UTC window and save a brief with citations and missing evidence.",
    kind: "integrate",
    category: "Developer",
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL, "search_documents", "write_document"],
    integrations: (["pagerduty", "sentry", "github"] as const).map((provider) => ({
      id: provider,
      providerId: provider,
      name: configuredComposioToolkits[provider].name,
      description: configuredComposioToolkits[provider].description,
      requiresConnection: true,
      connectionGroup: "evidence",
      operationIds: incidentBriefOperations[provider],
    })),
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
      { key: "serviceName", label: "Service", type: "text", required: true },
      { key: "environment", label: "Environment", type: "text", required: true },
      {
        key: "windowHours",
        label: "Evidence window in hours",
        type: "number",
        required: true,
        defaultValue: 24,
      },
      { key: "pagerDutyServiceId", label: "PagerDuty service ID", type: "text" },
      { key: "sentryOrganisation", label: "Sentry organisation", type: "text" },
      { key: "sentryProject", label: "Sentry project", type: "text" },
      { key: "githubOwner", label: "GitHub owner", type: "text" },
      { key: "githubRepository", label: "GitHub repository", type: "text" },
    ],
  },
];
