import { configuredComposioToolkits } from "~/lib/providers/capabilities/connectors/composio/configured-toolkit-manifest";

import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, preferredConnectorsField, reviewInstructionsField } from "./shared";

type ConfiguredComposioProvider = keyof typeof configuredComposioToolkits;

interface WorkflowSpec {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: CatalogRecipe["category"];
  providers: ConfiguredComposioProvider[];
  actions: string[];
  setupPrompt: string;
}

function selectWorkflowOperations(provider: ConfiguredComposioProvider): string[] {
  return configuredComposioToolkits[provider].operations.map((operation) => operation.id);
}

function createWorkflowRecipe(spec: WorkflowSpec): CatalogRecipe {
  return {
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    description: spec.description,
    kind: "integrate",
    category: spec.category,
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: spec.providers.map((provider) => ({
      id: provider,
      providerId: provider,
      name: configuredComposioToolkits[provider].name,
      description: configuredComposioToolkits[provider].description,
      requiresConnection: true,
      connectionGroup: "services",
      operationIds: selectWorkflowOperations(provider),
    })),
    triggers: [
      {
        type: "message",
        label: `Run ${spec.title}`,
        description: spec.summary,
      },
    ],
    actions: spec.actions,
    setupPrompt: spec.setupPrompt,
    configurationFields: [
      preferredConnectorsField,
      {
        key: "workflowRules",
        label: "Workflow rules",
        type: "textarea",
        placeholder: "Scope, filters, destinations, naming, and review requirements",
      },
      reviewInstructionsField,
    ],
  };
}

const workflowSpecs: WorkflowSpec[] = [
  {
    id: "project-delivery-control",
    title: "Project Delivery Control",
    summary: "Coordinate projects, tasks, issues, and knowledge across delivery systems.",
    description:
      "Reviews delivery state across connected project systems and performs approved task, issue, and workspace actions.",
    category: "Productivity",
    providers: [
      "airtable",
      "asana",
      "basecamp",
      "clickup",
      "confluence",
      "jira",
      "linear",
      "monday",
      "notion",
      "shortcut",
      "ticktick",
      "todoist",
      "trello",
      "wrike",
    ],
    actions: [
      "Review project, issue, and task state",
      "Create or update approved delivery records",
      "Coordinate work across selected connected systems",
    ],
    setupPrompt:
      "Set up Project Delivery Control. Ask which connected delivery systems, teams, projects, and work types to use. Confirm every write action and its exact destination before execution.",
  },
  {
    id: "engineering-release-operations",
    title: "Engineering Release Operations",
    summary: "Operate repositories, deployments, infrastructure, packages, and release controls.",
    description:
      "Combines connected source-control, hosting, infrastructure, package, and API platforms for release work.",
    category: "Developer",
    providers: [
      "_1password",
      "algolia",
      "bitbucket",
      "cloudflare",
      "cloudflare_api_key",
      "convex",
      "cursor",
      "digital_ocean",
      "docker_hub",
      "fly",
      "gist",
      "gitea",
      "github",
      "gitlab",
      "hostinger",
      "launch_darkly",
      "neon",
      "ngrok",
      "npm",
      "postman",
      "railway",
      "supabase",
      "vercel",
      "wakatime",
    ],
    actions: [
      "Inspect repositories, builds, deployments, and runtime state",
      "Prepare release and infrastructure changes",
      "Execute approved engineering operations",
    ],
    setupPrompt:
      "Set up Engineering Release Operations. Ask which repositories, environments, services, and release stages to use. Treat deployments, secrets, repository writes, and infrastructure changes as explicit approval points.",
  },
  {
    id: "incident-observability-command",
    title: "Incident and Observability Command",
    summary: "Investigate telemetry, incidents, monitors, alerts, and service health.",
    description:
      "Correlates connected observability and incident-management systems and applies reviewed response actions.",
    category: "Developer",
    providers: ["datadog", "grafana", "incident_io", "kibana", "new_relic", "pagerduty", "sentry"],
    actions: [
      "Review alerts, errors, logs, incidents, and service health",
      "Correlate evidence across observability systems",
      "Apply approved incident-response changes",
    ],
    setupPrompt:
      "Set up Incident and Observability Command. Ask which services, environments, monitors, and incident systems to use. Read evidence first and confirm any monitor, incident, escalation, or configuration change.",
  },
  {
    id: "data-analytics-workbench",
    title: "Data and Analytics Workbench",
    summary: "Query data platforms and compare product, web, and marketing performance.",
    description:
      "Uses connected warehouses, spreadsheets, databases, and analytics platforms for governed analysis.",
    category: "Productivity",
    providers: [
      "clickhouse",
      "databricks",
      "excel",
      "fathom",
      "google_analytics",
      "google_search_console",
      "googleads",
      "googlebigquery",
      "googlesheets",
      "metabase",
      "microsoft_clarity",
      "mixpanel",
      "plausible_analytics",
      "posthog",
      "semrush",
    ],
    actions: [
      "Query connected data and analytics sources",
      "Compare trends, funnels, campaigns, and operational metrics",
      "Create approved analytical artefacts or records",
    ],
    setupPrompt:
      "Set up the Data and Analytics Workbench. Ask which connected sources, datasets, projects, date ranges, and metrics to use. Confirm queries that are expensive and any action that writes or changes data.",
  },
  {
    id: "customer-revenue-operations",
    title: "Customer and Revenue Operations",
    summary: "Coordinate CRM, support, billing, finance, and customer lifecycle work.",
    description:
      "Connects customer, support, billing, accounting, and revenue systems for reviewed operational workflows.",
    category: "Finance",
    providers: [
      "apollo",
      "attio",
      "better_proposals",
      "dynamics365",
      "freshdesk",
      "freshbooks",
      "harvest",
      "hubspot",
      "intercom",
      "klaviyo",
      "mailchimp",
      "pandadoc",
      "salesforce",
      "square",
      "stripe",
      "zendesk",
      "zoho",
    ],
    actions: [
      "Review customer, deal, support, billing, and payment state",
      "Prepare lifecycle and revenue follow-ups",
      "Execute confirmed CRM, support, and financial actions",
    ],
    setupPrompt:
      "Set up Customer and Revenue Operations. Ask which customer systems, pipelines, accounts, and financial scopes to use. Never change customer, billing, or payment state without confirming the exact record and action.",
  },
  {
    id: "content-design-publishing",
    title: "Content, Design, and Publishing",
    summary:
      "Move reviewed content and design work across files, documents, CMSs, and handoff tools.",
    description:
      "Coordinates connected file storage, documents, design platforms, CMSs, and publishing destinations.",
    category: "Productivity",
    providers: [
      "box",
      "canva",
      "contentful",
      "dropbox",
      "dropbox_sign",
      "figma",
      "gamma",
      "googledocs",
      "googledrive",
      "googlephotos",
      "googleslides",
      "heygen",
      "miro",
      "one_drive",
      "share_point",
      "webflow",
      "zeplin",
    ],
    actions: [
      "Find source files, documents, designs, and CMS content",
      "Prepare content and design handoffs",
      "Publish or modify content only after destination review",
    ],
    setupPrompt:
      "Set up Content, Design, and Publishing. Ask which connected sources and destinations to use, what the content lifecycle is, and who approves changes. Confirm every upload, share, edit, publish, or deletion.",
  },
  {
    id: "community-communications-operations",
    title: "Community and Communications Operations",
    summary: "Coordinate messages, communities, social channels, and team communications.",
    description:
      "Uses connected social, community, chat, mail, and collaboration platforms for reviewed communication work.",
    category: "Community",
    providers: [
      "agent_mail",
      "devto",
      "discord",
      "discordbot",
      "facebook",
      "gmail",
      "instagram",
      "line",
      "linkedin",
      "microsoft_teams",
      "outlook",
      "reddit",
      "slack",
      "slackbot",
      "webex",
      "whatsapp",
      "youtube",
    ],
    actions: [
      "Review relevant conversations and community activity",
      "Prepare channel-appropriate responses and posts",
      "Send, publish, moderate, or update only after confirmation",
    ],
    setupPrompt:
      "Set up Community and Communications Operations. Ask which connected channels, audiences, accounts, and tone rules to use. Confirm recipients, destination, identity, and final content before any external communication or moderation action.",
  },
  {
    id: "scheduling-event-operations",
    title: "Scheduling and Event Operations",
    summary: "Coordinate calendars, meetings, forms, tickets, and event logistics.",
    description:
      "Combines connected scheduling, calendar, meeting, ticketing, form, and transcription services.",
    category: "Scheduling",
    providers: [
      "cal",
      "calendly",
      "eventbrite",
      "fireflies",
      "googlecalendar",
      "googlemeet",
      "googletasks",
      "ticketmaster",
      "typeform",
      "zoom",
    ],
    actions: [
      "Review availability, meetings, events, forms, and tickets",
      "Prepare scheduling and event logistics",
      "Create or change bookings and events only after confirmation",
    ],
    setupPrompt:
      "Set up Scheduling and Event Operations. Ask which calendars, meeting systems, forms, ticket sources, date ranges, and timezones to use. Confirm attendees, times, destinations, and costs before write actions.",
  },
  {
    id: "research-intelligence-desk",
    title: "Research and Intelligence Desk",
    summary: "Gather structured web, location, scientific, market, and technical evidence.",
    description:
      "Uses connected browsing, extraction, search, location, scientific, market, and knowledge sources for evidence-led research.",
    category: "Students",
    providers: [
      "artificial_analysis",
      "browserbase_tool",
      "cloudflare_browser_rendering",
      "crawlbase",
      "firecrawl",
      "foursquare",
      "giphy",
      "google_maps",
      "googlesuper",
      "hugging_face",
      "hyperbrowser",
      "nasa",
      "nasdaq",
      "openweather_api",
      "serpapi",
      "stack_exchange",
      "tripadvisor",
      "wolfram_alpha_api",
      "yandex",
    ],
    actions: [
      "Collect evidence from selected structured and web sources",
      "Compare scientific, market, technical, and location findings",
      "Return sourced conclusions and preserve uncertainty",
    ],
    setupPrompt:
      "Set up the Research and Intelligence Desk. Ask which connected sources, geography, date range, evidence standard, and output format to use. Keep source boundaries clear and confirm any action that changes an external system.",
  },
  {
    id: "commerce-delivery-operations",
    title: "Commerce and Delivery Operations",
    summary: "Coordinate commerce, markets, messaging delivery, media, and campaign fulfilment.",
    description:
      "Connects trading, commerce, email delivery, media, and campaign platforms for controlled operational work.",
    category: "Shopping",
    providers: [
      "alpaca",
      "coinbase",
      "gumroad",
      "polymarket_us",
      "postmark",
      "resend",
      "sendgrid",
      "smugmug",
      "toneden",
    ],
    actions: [
      "Review market, order, delivery, and campaign state",
      "Prepare fulfilment and outbound delivery actions",
      "Execute financial or external delivery actions only after explicit approval",
    ],
    setupPrompt:
      "Set up Commerce and Delivery Operations. Ask which connected accounts, markets, products, campaigns, and delivery destinations to use. Confirm all monetary, order, trading, sending, and deletion actions immediately before execution.",
  },
];

export const composioWorkflowRecipes: CatalogRecipe[] = workflowSpecs.map(createWorkflowRecipe);
