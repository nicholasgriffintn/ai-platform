import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

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
		estimatedSetupMinutes: 3,
		enabledTools: ["run_code_review"],
		integrations: [
			{
				id: "github",
				providerId: "github",
				name: "GitHub App",
				description: "Uses the existing GitHub App installation connection.",
				requiresConnection: true,
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
		id: "gmail",
		title: "Gmail",
		summary: "Search Gmail and create reviewed draft replies from chat.",
		description:
			"Uses a connected Gmail account to search messages and prepare draft emails for review.",
		kind: "integrate",
		category: "Email",
		featured: true,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail messages and creates draft replies.",
				requiresConnection: true,
				operationIds: ["search_messages", "create_draft"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Gmail",
				description: "Ask Polychat to search Gmail or draft a reply.",
			},
		],
		actions: [
			"Search Gmail messages by query",
			"Summarise relevant message metadata",
			"Create draft emails only after confirming recipients, subject, and body",
		],
		setupPrompt:
			"Set up the Gmail recipe. Confirm what Gmail search or draft workflow I want, use Gmail search only for relevant messages, and create drafts only after I approve the recipient, subject, and body. Do not send, archive, delete, label, or modify messages.",
		configurationFields: [
			{
				key: "defaultSearch",
				label: "Default search",
				type: "text",
				placeholder: "from:client@example.com newer_than:14d",
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
		id: "outlook-mail",
		title: "Outlook Mail",
		summary: "Search Outlook mail and create reviewed draft replies from chat.",
		description:
			"Uses a connected Outlook account to search messages and prepare draft emails for review.",
		kind: "integrate",
		category: "Email",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook Mail",
				description: "Searches Outlook messages and creates draft replies.",
				requiresConnection: true,
				operationIds: ["search_messages", "create_draft"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Outlook mail",
				description: "Ask Polychat to search Outlook mail or draft a reply.",
			},
		],
		actions: [
			"Search Outlook messages",
			"Summarise message previews and links",
			"Create draft emails only after confirmation",
		],
		setupPrompt:
			"Set up the Outlook Mail recipe. Confirm the mailbox search or draft workflow, use Outlook mail search for relevant messages, and create drafts only after I approve the recipient, subject, and body. Do not send, delete, flag, move, or change messages.",
		configurationFields: [
			{
				key: "defaultSearch",
				label: "Default search",
				type: "text",
				placeholder: "Project name, sender, or recent topic",
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
		id: "google-calendar",
		title: "Google Calendar",
		summary: "Review upcoming events and create confirmed calendar events.",
		description:
			"Uses a connected Google Calendar to list upcoming events and create new events after confirmation.",
		kind: "integrate",
		category: "Calendar",
		featured: true,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Lists upcoming events and creates confirmed events.",
				requiresConnection: true,
				operationIds: ["list_events", "create_event"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about calendar",
				description: "Ask Polychat to review or create Google Calendar events.",
			},
		],
		actions: [
			"List upcoming calendar events",
			"Prepare event details for review",
			"Create calendar events only after confirming title, start, end, and timezone",
		],
		setupPrompt:
			"Set up the Google Calendar recipe. Ask which calendar workflow I want, list upcoming events when needed, and create events only after I confirm the title, start, end, timezone, and description. Do not update or delete events.",
		configurationFields: [
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
	{
		id: "outlook-calendar",
		title: "Outlook Calendar",
		summary: "Create confirmed Outlook calendar events from chat.",
		description:
			"Uses a connected Outlook account to create calendar events after the user confirms the details.",
		kind: "integrate",
		category: "Calendar",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook Calendar",
				description: "Creates confirmed Outlook calendar events.",
				requiresConnection: true,
				operationIds: ["create_calendar_event"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Outlook calendar",
				description: "Ask Polychat to create an Outlook calendar event.",
			},
		],
		actions: [
			"Prepare Outlook event details",
			"Confirm title, start, end, timezone, and description",
			"Create calendar events only after approval",
		],
		setupPrompt:
			"Set up the Outlook Calendar recipe. Ask what event I want to create and confirm the title, start, end, timezone, and description before using Outlook. Do not update, delete, invite, or RSVP unless a future connector operation explicitly supports it.",
		configurationFields: [
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
