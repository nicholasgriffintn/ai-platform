import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

export const developerRecipes: CatalogRecipe[] = [
	{
		id: "developer-standup",
		title: "Developer Standup",
		summary: "Summarise GitHub and Linear activity into standup notes.",
		description:
			"Combines connected GitHub repository context and Linear issue data to draft a standup update.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "github",
				providerId: "github",
				name: "GitHub",
				description: "Reads repository commits and pull requests through Composio.",
				requiresConnection: true,
				operationIds: [
					"GITHUB_GET_A_REPOSITORY",
					"GITHUB_LIST_COMMITS",
					"GITHUB_LIST_PULL_REQUESTS",
				],
			},
			{
				id: "linear",
				providerId: "linear",
				name: "Linear",
				description: "Searches Linear issues and projects.",
				requiresConnection: true,
				operationIds: ["LINEAR_SEARCH_ISSUES"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for standup notes",
				description: "Ask Polychat to prepare a standup draft.",
			},
			{
				type: "schedule",
				label: "Weekday reminder",
				description: "Run on a recurring standup schedule.",
			},
		],
		actions: [
			"Search Linear issues",
			"Inspect connected repository context when needed",
			"Draft yesterday, today, and blockers",
		],
		setupPrompt:
			"Set up the Developer Standup recipe. Ask which GitHub repositories and Linear team or project to use, gather recent activity, and draft a standup update. Ask before changing Linear or repository state.",
		configurationFields: [
			{
				key: "repositories",
				label: "Repositories",
				type: "string_list",
				placeholder: "owner/api, owner/app",
			},
			{
				key: "linearTeam",
				label: "Linear team or project",
				type: "text",
				placeholder: "Platform, Mobile, Sprint board",
			},
			{
				key: "standupFormat",
				label: "Standup format",
				type: "textarea",
				placeholder: "Yesterday, today, blockers, links, or team-specific format",
			},
		],
	},
	{
		id: "linear-triage",
		title: "Linear Triage",
		summary: "Search, summarise, and create Linear issues from chat.",
		description:
			"Uses a connected Linear workspace to find issues, summarise status, and create reviewed issues from chat.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "linear",
				providerId: "linear",
				name: "Linear",
				description: "Reads and creates Linear issues after confirmation.",
				requiresConnection: true,
				operationIds: ["LINEAR_SEARCH_ISSUES", "LINEAR_CREATE_LINEAR_ISSUE"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about issues",
				description: "Ask Polychat to search or create Linear issues.",
			},
		],
		actions: ["Search Linear issues", "Create reviewed issues", "Summarise project status"],
		setupPrompt:
			"Set up the Linear Triage recipe. Ask which team or project to use, search issues as needed, and create new issues only after I confirm the exact title, team, and description. Do not update existing issues because this connector only supports search and issue creation.",
		configurationFields: [
			{
				key: "linearTeam",
				label: "Linear team or project",
				type: "text",
				required: true,
				placeholder: "Platform, Mobile, Customer issues",
			},
			{
				key: "issueDefaults",
				label: "Issue defaults",
				type: "textarea",
				placeholder: "Default labels, assignee rules, priority rules, or required fields",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "todoist",
		title: "Todoist",
		summary: "Manage Todoist tasks and projects from chat.",
		description:
			"Uses a connected Todoist account to list tasks, create reviewed tasks, and complete tasks after confirmation.",
		kind: "integrate",
		category: "To-dos",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "todoist",
				providerId: "todoist",
				name: "Todoist",
				description: "Lists, creates, and completes Todoist tasks.",
				requiresConnection: true,
				operationIds: ["TODOIST_GET_ALL_TASKS", "TODOIST_CREATE_TASK", "TODOIST_CLOSE_TASK_V1"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about tasks",
				description: "Ask Polychat to review, create, or complete Todoist tasks.",
			},
		],
		actions: [
			"List active tasks by project, label, parent, or section",
			"Create reviewed Todoist tasks with due dates and labels",
			"Complete tasks only after confirming the task ID or exact task",
		],
		setupPrompt:
			"Set up the Todoist recipe. Ask which projects, labels, or task views I want to use. List tasks when needed, create tasks only after I confirm the content, due date, project, and labels, and complete tasks only after I confirm the exact task. Do not delete, move, or reopen tasks because this connector does not support those operations.",
		configurationFields: [
			{
				key: "defaultProject",
				label: "Default project",
				type: "text",
				placeholder: "Inbox, Work, Personal, or a project ID",
			},
			{
				key: "defaultLabels",
				label: "Default labels",
				type: "string_list",
				placeholder: "work, errands, follow-up",
			},
			{
				key: "taskRules",
				label: "Task rules",
				type: "textarea",
				placeholder: "Due-date wording, confirmation rules, priority defaults, or labels to avoid",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "posthog",
		title: "PostHog",
		summary: "Query product analytics and project data from chat.",
		description:
			"Uses a connected PostHog personal API key to list projects and run read-only HogQL analytics queries.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "posthog",
				providerId: "posthog",
				name: "PostHog",
				description: "Lists projects and runs read-only HogQL queries.",
				requiresConnection: true,
				operationIds: [
					"POSTHOG_LIST_ORGANIZATION_PROJECTS",
					"POSTHOG_CREATE_QUERY_IN_PROJECT_BY_ID",
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about product analytics",
				description: "Ask Polychat to query PostHog product analytics.",
			},
		],
		actions: [
			"List PostHog projects for a configured organization",
			"Run bounded read-only HogQL queries",
			"Summarise product analytics results without changing PostHog data",
		],
		setupPrompt:
			"Set up the PostHog recipe. Use saved PostHog region and project ID when available; ask only for missing region or project ID. Organization ID is optional and only needed when listing projects for an organization. Run only read-only HogQL queries and keep result limits bounded. Do not create, update, delete, or mutate PostHog data because this connector is read-only.",
		configurationFields: [
			{
				key: "region",
				label: "Region",
				type: "text",
				placeholder: "us, eu, or app",
				defaultValue: "us",
			},
			{
				key: "organizationId",
				label: "Organization ID",
				type: "text",
				placeholder: "PostHog organization ID",
			},
			{
				key: "projectId",
				label: "Project ID",
				type: "text",
				required: true,
				placeholder: "PostHog project ID",
			},
			{
				key: "defaultQuestion",
				label: "Default question",
				type: "textarea",
				placeholder: "Conversion, activation, retention, feature usage, or error analysis focus",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "devin",
		title: "Devin",
		summary: "Start Devin sessions, check progress, and send follow-up messages from chat.",
		description:
			"Uses a connected Devin service user API key to create and inspect Devin sessions in a configured organisation.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "devin",
				providerId: "devin",
				name: "Devin",
				description: "Starts sessions, checks session state, and sends follow-up messages.",
				requiresConnection: true,
				operationIds: [
					"list_sessions",
					"get_session",
					"create_session",
					"list_messages",
					"send_message",
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask Devin to work",
				description: "Ask Polychat to start or inspect a Devin session.",
			},
		],
		actions: [
			"List recent Devin sessions for the configured organisation",
			"Start a reviewed Devin session with a task prompt, repository list, tags, and ACU cap",
			"Check session messages and send follow-up instructions after confirmation",
		],
		setupPrompt:
			"Set up the Devin recipe. Ask for the Devin organisation ID, default repositories, default tags, optional playbook ID, and maximum ACU limit. Before creating a session or sending a follow-up message, confirm the prompt, repositories, tags, playbook, and cost boundary. Never include secrets in a Devin prompt, session message, or tag.",
		configurationFields: [
			{
				key: "organizationId",
				label: "Organisation ID",
				type: "text",
				required: true,
				placeholder: "org-abc123def456",
			},
			{
				key: "defaultRepos",
				label: "Default repositories",
				type: "string_list",
				placeholder: "owner/repo",
			},
			{
				key: "defaultTags",
				label: "Default tags",
				type: "string_list",
				placeholder: "polychat, recipe",
			},
			{
				key: "playbookId",
				label: "Playbook ID",
				type: "text",
				placeholder: "playbook-...",
			},
			{
				key: "maxAcuLimit",
				label: "Max ACU limit",
				type: "number",
				placeholder: "3",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "netlify",
		title: "Netlify",
		summary: "Inspect Netlify sites, deploys, and deployment status from chat.",
		description:
			"Uses a connected Netlify personal access token to list sites, review deploy history, and check deployment status without changing Netlify resources.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "netlify",
				providerId: "netlify",
				name: "Netlify",
				description: "Lists sites, deploy history, and deployment status.",
				requiresConnection: true,
				operationIds: ["list_sites", "list_deploys", "get_deploy"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Netlify deploys",
				description: "Ask Polychat to inspect Netlify sites, deploy history, or deployment status.",
			},
		],
		actions: [
			"List accessible Netlify sites",
			"Review recent deploys for a selected site",
			"Check deployment state for a selected deploy",
		],
		setupPrompt:
			"Set up the Netlify recipe. Ask which site ID or domain, branch, and deployment focus to use. Use only read-only Netlify operations to list sites, review deploy history, and check deployment status. Do not create deploys, restore deploys, edit sites, change environment variables, change hooks, or mutate Netlify resources because this connector is read-only.",
		configurationFields: [
			{
				key: "siteId",
				label: "Site ID or domain",
				type: "text",
				placeholder: "site-id or example.netlify.app",
			},
			{
				key: "defaultBranch",
				label: "Default branch",
				type: "text",
				placeholder: "main",
			},
			{
				key: "defaultDeployFocus",
				label: "Default deploy focus",
				type: "textarea",
				placeholder: "Failed deploys, production deploys, deploy status, or recent changes",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "cloudflare",
		title: "Cloudflare",
		summary: "Inspect Cloudflare accounts, zones, Workers, and deployments from chat.",
		description:
			"Uses a connected Cloudflare API token to list accounts, zones, Workers, and Worker deployments without changing Cloudflare resources.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "cloudflare",
				providerId: "cloudflare",
				name: "Cloudflare",
				description: "Lists accounts, zones, Workers, and Worker deployments.",
				requiresConnection: true,
				operationIds: ["CLOUDFLARE_LIST_ACCOUNTS", "CLOUDFLARE_LIST_ZONES"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Cloudflare",
				description: "Ask Polychat to inspect Cloudflare accounts, zones, Workers, or deployments.",
			},
		],
		actions: [
			"List accessible Cloudflare accounts",
			"List zones by account, domain name, or status",
			"Review Workers scripts and deployment history",
		],
		setupPrompt:
			"Set up the Cloudflare recipe. Ask which account ID, zone name, Worker script, and deployment focus to use. Use only read-only Cloudflare operations to list accounts, zones, Workers, and Worker deployments. Do not create deployments, edit zones, change DNS, purge caches, update Workers, change secrets, or mutate Cloudflare resources because this connector is read-only.",
		configurationFields: [
			{
				key: "accountId",
				label: "Account ID",
				type: "text",
				placeholder: "Cloudflare account ID",
			},
			{
				key: "zoneName",
				label: "Zone name",
				type: "text",
				placeholder: "example.com",
			},
			{
				key: "scriptName",
				label: "Worker script name",
				type: "text",
				placeholder: "my-worker",
			},
			{
				key: "defaultDeployFocus",
				label: "Default deploy focus",
				type: "textarea",
				placeholder: "Latest Worker deploy, failed deploys, zone status, or account overview",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "webflow",
		title: "Webflow",
		summary: "Inspect Webflow sites, CMS collections, and CMS items from chat.",
		description:
			"Uses a connected Webflow Data API token to list sites, CMS collections, and collection items without changing Webflow content.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "webflow",
				providerId: "webflow",
				name: "Webflow",
				description: "Lists sites, CMS collections, and CMS items.",
				requiresConnection: true,
				operationIds: [
					"WEBFLOW_LIST_WEBFLOW_SITES",
					"WEBFLOW_LIST_COLLECTIONS",
					"WEBFLOW_LIST_COLLECTION_ITEMS",
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Webflow CMS",
				description: "Ask Polychat to inspect Webflow sites, CMS collections, or items.",
			},
		],
		actions: [
			"List accessible Webflow sites",
			"Review CMS collections for a selected site",
			"Review CMS items for a selected collection",
		],
		setupPrompt:
			"Set up the Webflow recipe. Ask which site ID, collection ID, locale, and CMS content focus to use. Use only read-only Webflow Data API operations to list sites, collections, and items. Do not create, update, delete, publish, unpublish, or mutate Webflow sites or CMS content because this connector is read-only.",
		configurationFields: [
			{
				key: "siteId",
				label: "Site ID",
				type: "text",
				placeholder: "Webflow site ID",
			},
			{
				key: "collectionId",
				label: "Collection ID",
				type: "text",
				placeholder: "CMS collection ID",
			},
			{
				key: "cmsLocaleId",
				label: "CMS locale ID",
				type: "text",
				placeholder: "Optional locale ID",
			},
			{
				key: "defaultContentFocus",
				label: "Default content focus",
				type: "textarea",
				placeholder: "Draft review, recent updates, missing slugs, or content audit",
			},
			reviewInstructionsField,
		],
	},
];
