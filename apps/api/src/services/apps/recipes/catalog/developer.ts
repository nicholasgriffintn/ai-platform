import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, preferredConnectorsField, reviewInstructionsField } from "./shared";

export const developerRecipes: CatalogRecipe[] = [
	{
		id: "developer-standup",
		title: "Developer Standup",
		summary: "Summarise recent GitHub and Linear activity into standup notes.",
		description:
			"Uses whichever of GitHub and Linear is connected to draft a standup update from recent commits, pull requests, and issues.",
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
				connectionGroup: "activity",
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
				connectionGroup: "activity",
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
			"Set up the Developer Standup recipe. Use whichever of GitHub and Linear is connected, ask which repositories or team to focus on, gather recent activity, and draft a standup update. Ask before changing Linear or repository state.",
		configurationFields: [
			preferredConnectorsField,
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
		id: "coding-agents",
		title: "Coding Agents",
		summary: "Start, inspect, and follow up on background coding agents from chat.",
		description:
			"Uses whichever of Devin and Cursor is connected to review background coding-agent sessions, start reviewed Devin sessions, and send follow-up messages.",
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
				connectionGroup: "agents",
				operationIds: [
					"list_sessions",
					"get_session",
					"create_session",
					"list_messages",
					"send_message",
				],
			},
			{
				id: "cursor",
				providerId: "cursor",
				name: "Cursor",
				description: "Lists background agents, conversations, models, and repositories.",
				requiresConnection: true,
				connectionGroup: "agents",
				operationIds: [
					"CURSOR_GET_ME",
					"CURSOR_LIST_AGENTS",
					"CURSOR_GET_AGENT_CONVERSATION",
					"CURSOR_LIST_MODELS",
					"CURSOR_LIST_REPOSITORIES",
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about coding agents",
				description: "Ask Polychat to start, inspect, or follow up on an agent session.",
			},
		],
		actions: [
			"List recent agent sessions and their conversations",
			"Start a reviewed Devin session with a task prompt, repository list, tags, and ACU cap",
			"Send follow-up instructions only after confirmation",
		],
		setupPrompt:
			"Set up the Coding Agents recipe. Use the connected agent services; capabilities differ, so use only the operations discovery reports for each. For Devin, ask for the organisation ID, default repositories, default tags, optional playbook ID, and maximum ACU limit, and confirm the prompt, repositories, tags, playbook, and cost boundary before creating a session or sending a follow-up. Never include secrets in an agent prompt, message, or tag.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "organizationId",
				label: "Devin organisation ID",
				type: "text",
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
		id: "deployment-status",
		title: "Deployment Status",
		summary: "Inspect hosting sites, zones, and deploy status across connected platforms.",
		description:
			"Uses whichever of Netlify and Cloudflare is connected to review sites, zones, deploy history, and deployment status without changing hosting resources.",
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
				connectionGroup: "hosting",
				operationIds: ["list_sites", "list_deploys", "get_deploy"],
			},
			{
				id: "cloudflare",
				providerId: "cloudflare",
				name: "Cloudflare",
				description: "Lists accounts and zones with their status.",
				requiresConnection: true,
				connectionGroup: "hosting",
				operationIds: ["CLOUDFLARE_LIST_ACCOUNTS", "CLOUDFLARE_LIST_ZONES"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about deploys",
				description: "Ask Polychat to inspect sites, zones, deploy history, or deployment status.",
			},
		],
		actions: [
			"List accessible sites, accounts, and zones",
			"Review recent deploys for a selected Netlify site",
			"Check deployment and zone status without changing anything",
		],
		setupPrompt:
			"Set up the Deployment Status recipe. Use the connected hosting services, ask which sites, domains, or zones to focus on, and review deploy history and status. Use only read-only operations. Do not create deploys, restore deploys, edit sites or zones, change DNS, purge caches, change environment variables, or mutate hosting resources because these connectors are read-only.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "targets",
				label: "Sites, domains, or zones",
				type: "string_list",
				placeholder: "example.netlify.app, example.com, account ID",
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
];
