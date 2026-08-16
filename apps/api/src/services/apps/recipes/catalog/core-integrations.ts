import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, preferredConnectorsField, reviewInstructionsField } from "./shared";

export const coreIntegrationRecipes: CatalogRecipe[] = [
	{
		id: "repository-code-review",
		title: "Repository Code Review",
		summary: "Review a connected GitHub repository from chat using the sandbox worker.",
		description:
			"Uses an installed GitHub App connection to run a read-only code review in an isolated sandbox.",
		kind: "integrate",
		category: "Developer",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "github",
				providerId: "github",
				name: "GitHub",
				description: "Reads repository, commit, pull-request, and source content through Composio.",
				requiresConnection: true,
				operationIds: [
					"GITHUB_GET_A_REPOSITORY",
					"GITHUB_GET_REPOSITORY_CONTENT",
					"GITHUB_LIST_COMMITS",
					"GITHUB_LIST_PULL_REQUESTS_FILES",
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for a review",
				description: "Send the repository, branch, and review focus from chat.",
			},
		],
		actions: [
			"Confirm the connected installation and repository",
			"Run a read-only sandbox code review",
			"Return findings without committing changes",
		],
		setupPrompt:
			"Set up the Repository Code Review recipe. Confirm my GitHub App connection, ask which repository and branch to review, ask for the review focus, then run the code review tool only after I confirm the target.",
		configurationFields: [
			{
				key: "repository",
				label: "Repository",
				type: "text",
				required: true,
				placeholder: "owner/repo",
			},
			{
				key: "branch",
				label: "Branch",
				type: "text",
				placeholder: "main",
			},
			{
				key: "reviewFocus",
				label: "Review focus",
				type: "textarea",
				placeholder: "Security, regressions, tests, accessibility, or a specific feature",
			},
		],
	},
	{
		id: "email-assistant",
		title: "Email Assistant",
		summary: "Search connected mail and create reviewed draft replies from chat.",
		description:
			"Uses whichever mail account is connected, Gmail or Outlook, to search messages and prepare draft emails for review.",
		kind: "integrate",
		category: "Email",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail messages and creates draft replies.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["GMAIL_FETCH_EMAILS", "GMAIL_CREATE_EMAIL_DRAFT"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches Outlook messages and creates draft replies.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["OUTLOOK_SEARCH_MESSAGES", "OUTLOOK_CREATE_DRAFT"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about your email",
				description: "Ask Polychat to search mail or draft a reply.",
			},
		],
		actions: [
			"Search connected mail by query",
			"Summarise relevant message metadata",
			"Create draft emails only after confirming recipients, subject, and body",
		],
		setupPrompt:
			"Set up the Email Assistant recipe. Confirm what search or draft workflow I want, use the connected mail service to find relevant messages, and create drafts only after I approve the recipient, subject, and body. Do not send, archive, delete, label, flag, move, or modify messages.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "defaultSearch",
				label: "Default search",
				type: "text",
				placeholder: "from:client@example.com newer_than:14d, project name, or sender",
			},
			{
				key: "draftRules",
				label: "Draft rules",
				type: "textarea",
				placeholder: "Tone, sign-off, recipients to avoid, or review requirements",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "calendar-assistant",
		title: "Calendar Assistant",
		summary: "Review upcoming events and create confirmed events in your connected calendar.",
		description:
			"Uses whichever calendar is connected, Google Calendar or Outlook, to list upcoming events and create new events after confirmation.",
		kind: "integrate",
		category: "Calendar",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "googlecalendar",
				providerId: "googlecalendar",
				name: "Google Calendar",
				description: "Lists upcoming events and creates confirmed events.",
				requiresConnection: true,
				connectionGroup: "calendar",
				operationIds: ["GOOGLECALENDAR_EVENTS_LIST", "GOOGLECALENDAR_CREATE_EVENT"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook Calendar",
				description: "Lists upcoming Outlook events and creates confirmed events.",
				requiresConnection: true,
				connectionGroup: "calendar",
				operationIds: ["OUTLOOK_GET_CALENDAR_VIEW", "OUTLOOK_CALENDAR_CREATE_EVENT"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about your calendar",
				description: "Ask Polychat to review or create calendar events.",
			},
		],
		actions: [
			"List upcoming calendar events",
			"Prepare event details for review",
			"Create calendar events only after confirming title, start, end, and timezone",
		],
		setupPrompt:
			"Set up the Calendar Assistant recipe. Ask which calendar workflow I want, list upcoming events from the connected calendar when needed, and create events only after I confirm the title, start, end, timezone, and description. Do not update or delete events.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "calendarWindow",
				label: "Calendar window",
				type: "text",
				placeholder: "Today, next 7 days, weekday mornings",
			},
			{
				key: "timeZone",
				label: "Timezone",
				type: "text",
				placeholder: "Europe/London, America/New_York",
			},
			reviewInstructionsField,
		],
	},
];
