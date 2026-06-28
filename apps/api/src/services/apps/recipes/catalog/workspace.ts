import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField, notionTargetField } from "./shared";

export const workspaceRecipes: CatalogRecipe[] = [
	{
		id: "asana",
		title: "Asana",
		summary: "Organise work across projects with reviewed Asana task actions.",
		description:
			"Uses a connected Asana workspace to list projects, review tasks, and create confirmed tasks from chat.",
		kind: "integrate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "asana",
				providerId: "asana",
				name: "Asana",
				description: "Lists projects and creates reviewed Asana tasks.",
				requiresConnection: true,
				operationIds: ["list_projects", "list_tasks", "create_task"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Asana work",
				description: "Ask Polychat to review or create Asana tasks.",
			},
		],
		actions: [
			"List accessible Asana projects",
			"Review tasks in a project or workspace",
			"Create tasks only after confirming project, title, notes, assignee, and due date",
		],
		setupPrompt:
			"Set up the Asana recipe. Ask which workspace and projects to use, list projects or tasks when needed, and create tasks only after I confirm the project, task name, notes, assignee, and due date. Do not update, complete, delete, or reassign existing tasks unless a future connector operation explicitly supports it.",
		configurationFields: [
			{
				key: "workspaceId",
				label: "Workspace ID",
				type: "text",
				placeholder: "Asana workspace gid",
			},
			{
				key: "projectIds",
				label: "Project IDs",
				type: "string_list",
				placeholder: "Asana project gids",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "notion-workspace-assistant",
		title: "Notion Workspace Assistant",
		summary: "Search Notion and create reviewed pages from chat.",
		description:
			"Uses a connected Notion workspace to find pages or databases, create reviewed pages, and append notes to selected pages.",
		kind: "integrate",
		category: "Productivity",
		featured: true,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "notion",
				providerId: "notion",
				name: "Notion",
				description: "Searches pages and creates or appends reviewed Notion content.",
				requiresConnection: true,
				operationIds: ["search", "retrieve_page", "create_page", "append_block_children"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Notion",
				description: "Ask Polychat to search Notion or prepare a reviewed page.",
			},
		],
		actions: [
			"Search Notion pages and databases",
			"Create reviewed Notion pages",
			"Append approved notes to selected pages",
		],
		setupPrompt:
			"Set up the Notion Workspace Assistant recipe. Ask which workspace area, page, or database to use, search Notion when needed, and create or append Notion content only after I confirm the exact target and content.",
		configurationFields: [
			notionTargetField,
			{
				key: "contentRules",
				label: "Content rules",
				type: "textarea",
				placeholder: "Page template, database properties, review rules, or append format",
			},
		],
	},
	{
		id: "notion-action-log",
		title: "Notion Action Log",
		summary: "Capture chat decisions and follow-ups into Notion.",
		description:
			"Turns confirmed decisions, action items, and weekly recap notes into reviewed Notion entries.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 5,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "notion",
				providerId: "notion",
				name: "Notion",
				description: "Creates or appends action-log notes in a selected Notion page or database.",
				requiresConnection: true,
				operationIds: ["search", "create_page", "append_block_children"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Log a note",
				description: "Ask Polychat to capture a decision, action item, or recap.",
			},
		],
		actions: [
			"Find the configured Notion log page or database",
			"Prepare decision and action-item notes",
			"Append or create entries after confirmation",
		],
		setupPrompt:
			"Set up the Notion Action Log recipe. Ask which Notion page or database should store action logs, confirm the format for decisions and follow-ups, and write to Notion only after I approve the exact entry and target.",
		configurationFields: [
			notionTargetField,
			{
				key: "entryFormat",
				label: "Entry format",
				type: "textarea",
				placeholder: "Decision, owner, due date, source conversation, and follow-up fields",
			},
			reviewInstructionsField,
		],
	},
];
