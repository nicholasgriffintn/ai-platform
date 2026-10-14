import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, preferredConnectorsField, reviewInstructionsField } from "./shared";

export const configuredComposioRecipes: CatalogRecipe[] = [
  {
    id: "analytics-insights",
    title: "Analytics Insights",
    summary: "Ask questions of your connected analytics platforms and get sourced answers.",
    description:
      "Uses whichever of Metabase, Plausible, and PostHog is connected to run read-only queries across BI dashboards, site traffic, and product analytics.",
    kind: "integrate",
    category: "Productivity",
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: [
      {
        id: "metabase",
        providerId: "metabase",
        name: "Metabase",
        description: "Searches BI content and executes saved or ad-hoc analytics queries.",
        requiresConnection: true,
        connectionGroup: "analytics",
        operationIds: [
          "METABASE_GET_API_SEARCH",
          "METABASE_GET_API_ACTIVITY_POPULAR_ITEMS",
          "METABASE_GET_API_ACTIVITY_RECENT_VIEWS",
          "METABASE_GET_DASHBOARD_BY_ID",
          "METABASE_GET_DASHBOARD_RELATED",
          "METABASE_GET_API_CARD_ID",
          "METABASE_GET_CARD_QUERY_METADATA",
          "METABASE_CREATE_CARD_QUERY1",
          "METABASE_POST_DASHBOARD_QUERY",
          "METABASE_POST_API_DATASET",
          "METABASE_POST_API_DATASET_PIVOT",
        ],
      },
      {
        id: "plausible_analytics",
        providerId: "plausible_analytics",
        name: "Plausible Analytics",
        description:
          "Reads site configuration and web analytics across aggregate and time dimensions.",
        requiresConnection: true,
        connectionGroup: "analytics",
        operationIds: [
          "PLAUSIBLE_ANALYTICS_CHECK_HEALTH",
          "PLAUSIBLE_ANALYTICS_LIST_SITES",
          "PLAUSIBLE_ANALYTICS_GET_SITE",
          "PLAUSIBLE_ANALYTICS_LIST_TEAMS",
          "PLAUSIBLE_ANALYTICS_LIST_GOALS",
          "PLAUSIBLE_ANALYTICS_LIST_CUSTOM_PROPS",
          "PLAUSIBLE_ANALYTICS_LIST_GUESTS",
          "PLAUSIBLE_ANALYTICS_GET_REALTIME_VISITORS",
          "PLAUSIBLE_ANALYTICS_QUERY_STATS",
          "PLAUSIBLE_ANALYTICS_GET_TIMESERIES_STATS",
          "PLAUSIBLE_ANALYTICS_GET_BREAKDOWN_STATS",
          "PLAUSIBLE_ANALYTICS_GET_PLUGIN_CAPABILITIES",
        ],
      },
      {
        id: "posthog",
        providerId: "posthog",
        name: "PostHog",
        description: "Lists projects and runs read-only HogQL product analytics queries.",
        requiresConnection: true,
        connectionGroup: "analytics",
        operationIds: [
          "POSTHOG_LIST_ORGANIZATION_PROJECTS",
          "POSTHOG_CREATE_QUERY_IN_PROJECT_BY_ID",
        ],
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Ask an analytics question",
        description: "Explore connected BI, web, and product analytics from chat.",
      },
      {
        type: "schedule",
        label: "Recurring metric review",
        description: "Run a saved read-only analytics review.",
      },
    ],
    actions: [
      "Discover relevant dashboards, sites, projects, and saved questions",
      "Run read-only queries against the connected analytics platforms",
      "Explain results with source links, query context, and metric definitions",
    ],
    setupPrompt:
      "Set up the Analytics Insights recipe. Use the connected analytics services and ask which sites, dashboards, projects, metrics, and reporting cadence matter. For PostHog, use the saved region and project ID and keep HogQL queries read-only and bounded. Explain query assumptions and metric definitions, and do not create, update, or delete analytics content in this recipe.",
    configurationFields: [
      preferredConnectorsField,
      {
        key: "projectId",
        label: "PostHog project ID",
        type: "text",
        placeholder: "PostHog project ID",
      },
      {
        key: "region",
        label: "PostHog region",
        type: "text",
        placeholder: "us, eu, or app",
        defaultValue: "us",
      },
      {
        key: "targets",
        label: "Sites, dashboards, or collections",
        type: "string_list",
        placeholder: "example.com, dashboard IDs, collection names",
      },
      {
        key: "metricQuestions",
        label: "Metric questions",
        type: "textarea",
        placeholder: "Revenue, activation, retention, traffic, conversion, or other KPIs",
      },
      reviewInstructionsField,
    ],
  },
];
