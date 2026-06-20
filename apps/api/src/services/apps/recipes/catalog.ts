import type {
	AssistantRecipe,
	RecipeCategory,
	RecipeConfigurationField,
	RecipeKind,
} from "@assistant/schemas";
import { recipeConnectorProviderSchema } from "@assistant/schemas";
import {
	isConnectorOperationSupported,
	isConnectorOperationWrite,
} from "~/lib/providers/capabilities/connectors";

export const RECIPE_CONNECTOR_TOOL = "use_recipe_connector";
export const RECIPE_LOOKUP_TOOL = "get_recipe";
export const RECIPE_TRIGGER_TOOL = "trigger_recipe";
export const RECIPE_SETUP_TOOL = "configure_recipe";
export const WEATHER_TOOL = "get_weather";
export const WEB_SEARCH_TOOL = "web_search";
export const IMAGE_TOOL = "create_image";
export const QR_TOOL = "create_qr_code";

type CatalogRecipeConfigurationField = Omit<RecipeConfigurationField, "required"> & {
	required?: boolean;
};

type CatalogRecipe = Omit<AssistantRecipe, "configurationFields"> & {
	configurationFields?: CatalogRecipeConfigurationField[];
};

const reviewInstructionsField: CatalogRecipeConfigurationField = {
	key: "instructions",
	label: "Review instructions",
	type: "textarea",
	placeholder: "Boundaries, preferred format, and what the assistant should confirm before acting",
};

const locationField: CatalogRecipeConfigurationField = {
	key: "location",
	label: "Location",
	type: "text",
	required: true,
	placeholder: "City, postcode, or coordinates",
};

const notionTargetField: CatalogRecipeConfigurationField = {
	key: "notionTarget",
	label: "Notion target",
	type: "text",
	required: true,
	placeholder: "Page, database, or workspace area",
};

const catalogRecipes: CatalogRecipe[] = [
	{
		id: "morning-briefing",
		title: "Morning Briefing",
		summary: "Summarise your calendar, priority emails, and likely focus areas.",
		description:
			"Uses connected email and calendar accounts to prepare a daily briefing that can be started manually, scheduled, or requested in chat.",
		kind: "automate",
		category: "Productivity",
		featured: true,
		estimatedSetupMinutes: 5,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Reads relevant recent messages when Gmail is connected.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description:
					"Reads relevant recent mail and upcoming calendar events when Outlook is connected.",
				requiresConnection: true,
				operationIds: ["search_messages", "list_events"],
			},
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Reads upcoming calendar events when Google Calendar is connected.",
				requiresConnection: true,
				operationIds: ["list_events"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for a briefing",
				description: "Ask Polychat for your morning briefing.",
			},
			{
				type: "schedule",
				label: "Daily schedule",
				description: "Run the briefing on a configured recurring schedule.",
			},
		],
		actions: [
			"Read upcoming calendar events",
			"Search for recent priority emails",
			"Summarise blockers, commitments, and suggested next steps",
		],
		setupPrompt:
			"Set up the Morning Briefing recipe. Confirm which connected mail and calendar providers I want to use, ask what time the briefing should run if I want a schedule, then prepare a concise briefing. Ask before marking, sending, or changing anything externally.",
		configurationFields: [
			{
				key: "mailProviders",
				label: "Mail providers",
				type: "string_list",
				placeholder: "Gmail, Outlook",
			},
			{
				key: "calendarProvider",
				label: "Calendar provider",
				type: "text",
				placeholder: "Google Calendar or Outlook",
			},
			{
				key: "briefingFocus",
				label: "Briefing focus",
				type: "textarea",
				placeholder: "Priority senders, projects, blockers, or commitments to highlight",
			},
		],
	},
	{
		id: "add-deadlines-to-calendar",
		title: "Add Deadlines to Calendar",
		summary: "Turn deadline emails into reviewed calendar events.",
		description:
			"Searches connected mail for deadline-style messages and creates calendar events from chat only after the user confirms the proposed event details.",
		kind: "automate",
		category: "Students",
		featured: true,
		estimatedSetupMinutes: 5,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for deadline messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description:
					"Searches Outlook mail for deadline messages and creates reviewed Outlook events.",
				requiresConnection: true,
				operationIds: ["search_messages", "create_calendar_event"],
			},
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Creates reviewed deadline events.",
				requiresConnection: true,
				operationIds: ["create_event"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for deadline extraction",
				description: "Ask Polychat to scan for deadlines and propose events.",
			},
		],
		actions: [
			"Search connected inboxes for deadline language",
			"Extract title, due date, source, and confidence",
			"Create calendar events after confirmation",
		],
		setupPrompt:
			"Set up the Add Deadlines to Calendar recipe. Ask which inboxes and calendars to use, search for deadline emails, propose events with confidence and source links, and create events only after I approve each one.",
		configurationFields: [
			{
				key: "inboxes",
				label: "Inboxes to scan",
				type: "string_list",
				placeholder: "School Gmail, Outlook",
			},
			{
				key: "calendarTarget",
				label: "Calendar target",
				type: "text",
				required: true,
				placeholder: "Primary calendar, Study calendar",
			},
			{
				key: "deadlineScope",
				label: "Deadline scope",
				type: "textarea",
				placeholder: "Courses, senders, date range, or assignment types to include",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "add-flights-to-calendar",
		title: "Add Flights to Calendar",
		summary: "Turn flight itinerary emails into reviewed calendar events.",
		description:
			"Searches connected mail for flight confirmations, extracts itinerary details, and creates reviewed calendar events after confirmation.",
		kind: "automate",
		category: "Travel",
		featured: true,
		estimatedSetupMinutes: 5,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for flight confirmation and itinerary messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description:
					"Searches Outlook mail for flight itineraries and creates reviewed Outlook calendar events.",
				requiresConnection: true,
				operationIds: ["search_messages", "create_calendar_event"],
			},
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Creates reviewed flight calendar events.",
				requiresConnection: true,
				operationIds: ["create_event"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask to add flights",
				description: "Ask Polychat to scan itinerary emails and propose calendar events.",
			},
		],
		actions: [
			"Search connected inboxes for airline confirmations and itinerary messages",
			"Extract flight numbers, airports, departure and arrival times, and confirmation codes",
			"Create calendar events only after confirming each proposed event",
		],
		setupPrompt:
			"Set up the Add Flights to Calendar recipe. Ask which inboxes and calendar to use, search for flight confirmations and itineraries, extract flight numbers, airports, local departure and arrival times, confirmation codes, and source links, then create calendar events only after I approve each event. Do not check in, contact airlines, or change bookings.",
		configurationFields: [
			{
				key: "inboxes",
				label: "Inboxes to scan",
				type: "string_list",
				placeholder: "Travel Gmail, Outlook",
			},
			{
				key: "calendarTarget",
				label: "Calendar target",
				type: "text",
				required: true,
				placeholder: "Travel calendar, primary calendar",
			},
			{
				key: "travelWindow",
				label: "Travel window",
				type: "text",
				placeholder: "Next 90 days, upcoming trip, this month",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "follow-up-reminders",
		title: "Follow-up Reminders",
		summary: "Find sent emails that likely need a follow-up and draft replies.",
		description:
			"Scans connected mail for sent messages without obvious replies, then drafts follow-up messages for review.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches sent Gmail conversations.",
				requiresConnection: true,
				operationIds: ["search_messages", "create_draft"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches sent Outlook conversations.",
				requiresConnection: true,
				operationIds: ["search_messages", "create_draft"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for follow-ups",
				description: "Ask Polychat to find follow-up candidates.",
			},
		],
		actions: [
			"Search sent mail for stale conversations",
			"Summarise why each message may need a follow-up",
			"Create draft follow-ups for review",
		],
		setupPrompt:
			"Set up the Follow-up Reminders recipe. Ask which mail provider to use, find likely unreplied sent messages, explain why each candidate matters, and create follow-up drafts only when I confirm.",
		configurationFields: [
			{
				key: "mailProvider",
				label: "Mail provider",
				type: "text",
				required: true,
				placeholder: "Gmail or Outlook",
			},
			{
				key: "followUpAfterDays",
				label: "Follow up after days",
				type: "number",
				defaultValue: 3,
				placeholder: "3",
			},
			{
				key: "draftTone",
				label: "Draft tone",
				type: "textarea",
				placeholder: "Short, polite, direct, friendly, or project-specific wording",
			},
		],
	},
	{
		id: "subscription-watchdog",
		title: "Subscription Watchdog",
		summary: "Watch mail for renewals, trials, and subscription charges.",
		description:
			"Uses connected mail search to identify upcoming renewals or trials and produce a reviewable spending summary.",
		kind: "automate",
		category: "Finance",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for renewal and trial messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches Outlook for renewal and trial messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for an audit",
				description: "Ask Polychat to review subscription messages.",
			},
			{
				type: "schedule",
				label: "Monthly audit",
				description: "Run a recurring subscription audit.",
			},
		],
		actions: [
			"Search for renewal and trial language",
			"Group likely subscriptions and dates",
			"Summarise cancellation links or next actions",
		],
		setupPrompt:
			"Set up the Subscription Watchdog recipe. Ask which inbox to scan, search for subscriptions, renewals, and trials, then summarise likely charges and cancellation next steps. Do not send emails or change accounts without approval.",
		configurationFields: [
			{
				key: "mailProvider",
				label: "Mail provider",
				type: "text",
				required: true,
				placeholder: "Gmail or Outlook",
			},
			{
				key: "reviewWindow",
				label: "Review window",
				type: "text",
				placeholder: "Next 30 days, this month, last 90 days",
			},
			{
				key: "watchCategories",
				label: "Watch categories",
				type: "string_list",
				placeholder: "SaaS, trials, domains, cloud services",
			},
		],
	},
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
	{
		id: "developer-standup",
		title: "Developer Standup",
		summary: "Summarise GitHub and Linear activity into standup notes.",
		description:
			"Combines connected GitHub repository context and Linear issue data to draft a standup update.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		estimatedSetupMinutes: 5,
		enabledTools: [RECIPE_CONNECTOR_TOOL, "run_code_review"],
		integrations: [
			{
				id: "github",
				providerId: "github",
				name: "GitHub",
				description: "Uses the existing GitHub App installation connection.",
				requiresConnection: true,
			},
			{
				id: "linear",
				providerId: "linear",
				name: "Linear",
				description: "Searches Linear issues and projects.",
				requiresConnection: true,
				operationIds: ["search_issues"],
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
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "linear",
				providerId: "linear",
				name: "Linear",
				description: "Reads and creates Linear issues after confirmation.",
				requiresConnection: true,
				operationIds: ["search_issues", "create_issue"],
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
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "todoist",
				providerId: "todoist",
				name: "Todoist",
				description: "Lists, creates, and completes Todoist tasks.",
				requiresConnection: true,
				operationIds: ["list_tasks", "create_task", "complete_task"],
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
		id: "sentry",
		title: "Sentry",
		summary: "Review Sentry projects and unresolved issues from chat.",
		description:
			"Uses a connected Sentry organization to list projects, review unresolved issues, and inspect issue details without mutating incidents.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "sentry",
				providerId: "sentry",
				name: "Sentry",
				description: "Lists organizations, projects, and issue details.",
				requiresConnection: true,
				operationIds: ["list_organizations", "list_projects", "list_issues", "retrieve_issue"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Sentry incidents",
				description: "Ask Polychat to review Sentry projects and unresolved issues.",
			},
		],
		actions: [
			"List connected Sentry organizations",
			"List projects for a configured organization",
			"Review unresolved issues and retrieve issue details",
		],
		setupPrompt:
			"Set up the Sentry recipe. Ask which Sentry organization slug and projects to use, list organizations or projects when needed, and review unresolved issues using only read-only Sentry operations. Do not resolve, assign, comment on, delete, or otherwise mutate issues because this connector is read-only.",
		configurationFields: [
			{
				key: "organizationSlug",
				label: "Organization slug",
				type: "text",
				required: true,
				placeholder: "acme",
			},
			{
				key: "projectIds",
				label: "Project IDs",
				type: "string_list",
				placeholder: "12345, 67890",
			},
			{
				key: "issueQuery",
				label: "Issue query",
				type: "text",
				placeholder: "is:unresolved level:error",
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
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "posthog",
				providerId: "posthog",
				name: "PostHog",
				description: "Lists projects and runs read-only HogQL queries.",
				requiresConnection: true,
				operationIds: ["list_projects", "query"],
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
			"Set up the PostHog recipe. Ask which PostHog region, organization ID, and project ID to use. Run only read-only HogQL queries and keep result limits bounded. Do not create, update, delete, or mutate PostHog data because this connector is read-only.",
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
		estimatedSetupMinutes: 4,
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
		id: "vercel",
		title: "Vercel",
		summary: "Inspect Vercel projects, deployments, and build events from chat.",
		description:
			"Uses a connected Vercel access token to list projects, review deployments, and inspect deployment events without changing Vercel resources.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "vercel",
				providerId: "vercel",
				name: "Vercel",
				description: "Lists projects, deployments, and deployment events.",
				requiresConnection: true,
				operationIds: ["list_projects", "list_deployments", "get_deployment_events"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about deployments",
				description: "Ask Polychat to inspect Vercel projects, deployments, or build events.",
			},
		],
		actions: [
			"List accessible Vercel projects",
			"Review recent deployments by project, branch, target, state, or team",
			"Inspect deployment events and build output for a selected deployment",
		],
		setupPrompt:
			"Set up the Vercel recipe. Ask which team, project, branch, and environment to monitor. Use only read-only Vercel operations to list projects, review deployments, and inspect deployment events. Do not create deployments, edit projects, update domains, change environment variables, or mutate Vercel resources because this connector is read-only.",
		configurationFields: [
			{
				key: "teamId",
				label: "Team ID",
				type: "text",
				placeholder: "team_...",
			},
			{
				key: "teamSlug",
				label: "Team slug",
				type: "text",
				placeholder: "my-team",
			},
			{
				key: "projectId",
				label: "Project ID or name",
				type: "text",
				placeholder: "prj_... or project-name",
			},
			{
				key: "defaultTarget",
				label: "Default target",
				type: "text",
				placeholder: "production or preview",
			},
			{
				key: "defaultBranch",
				label: "Default branch",
				type: "text",
				placeholder: "main",
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
		estimatedSetupMinutes: 3,
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
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "cloudflare",
				providerId: "cloudflare",
				name: "Cloudflare",
				description: "Lists accounts, zones, Workers, and Worker deployments.",
				requiresConnection: true,
				operationIds: [
					"list_accounts",
					"list_zones",
					"list_workers",
					"list_worker_deployments",
					"get_worker_deployment",
				],
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
		id: "supabase",
		title: "Supabase",
		summary: "Inspect Supabase organizations, projects, Edge Functions, and branches from chat.",
		description:
			"Uses a connected Supabase Management API access token to list organizations, projects, Edge Functions, and database branches without changing Supabase resources.",
		kind: "integrate",
		category: "Developer",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "supabase",
				providerId: "supabase",
				name: "Supabase",
				description: "Lists organizations, projects, Edge Functions, and database branches.",
				requiresConnection: true,
				operationIds: ["list_organizations", "list_projects", "list_functions", "list_branches"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Supabase",
				description:
					"Ask Polychat to inspect Supabase organizations, projects, Edge Functions, or database branches.",
			},
		],
		actions: [
			"List accessible Supabase organizations and projects",
			"Review Edge Functions for a selected project",
			"Review database branches for a selected project",
		],
		setupPrompt:
			"Set up the Supabase recipe. Ask which organization slug, project ref, branch focus, and Edge Function focus to use. Use only read-only Supabase Management API operations to list organizations, projects, Edge Functions, and branches. Do not create projects, deploy functions, change branches, update settings, rotate keys, run SQL, or mutate Supabase resources because this connector is read-only.",
		configurationFields: [
			{
				key: "organizationSlug",
				label: "Organization slug",
				type: "text",
				placeholder: "my-org",
			},
			{
				key: "projectRef",
				label: "Project ref",
				type: "text",
				placeholder: "abcdefghijklmnopqrst",
			},
			{
				key: "defaultBranch",
				label: "Default branch",
				type: "text",
				placeholder: "main, preview branch name, or production",
			},
			{
				key: "defaultFunctionFocus",
				label: "Default function focus",
				type: "textarea",
				placeholder: "Failed functions, recently updated functions, JWT settings, or deploy review",
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
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "webflow",
				providerId: "webflow",
				name: "Webflow",
				description: "Lists sites, CMS collections, and CMS items.",
				requiresConnection: true,
				operationIds: ["list_sites", "list_collections", "list_items"],
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
	{
		id: "fitbit",
		title: "Fitbit",
		summary: "Review Fitbit activity, sleep, and heart-rate data from chat.",
		description:
			"Uses a connected Fitbit account to read profile, daily activity, sleep logs, and heart-rate summaries without writing health data.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "fitbit",
				providerId: "fitbit",
				name: "Fitbit",
				description: "Reads profile, daily activity, sleep logs, and heart-rate summaries.",
				requiresConnection: true,
				operationIds: ["profile", "daily_activity", "sleep_logs", "heart_rate"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Fitbit data",
				description: "Ask Polychat to review Fitbit activity, sleep, or heart-rate data.",
			},
		],
		actions: [
			"Read the connected Fitbit profile",
			"Review daily activity, sleep logs, and heart-rate summaries",
			"Summarise wellness trends without giving medical diagnosis or safety-critical advice",
		],
		setupPrompt:
			"Set up the Fitbit recipe. Ask which dates, health metrics, and summary style to use. Use only read-only Fitbit operations for profile, activity, sleep, and heart-rate data. Do not log activities, edit goals, delete entries, or present medical diagnosis or safety-critical advice.",
		configurationFields: [
			{
				key: "defaultDate",
				label: "Default date",
				type: "text",
				placeholder: "today or yyyy-MM-dd",
				defaultValue: "today",
			},
			{
				key: "metricFocus",
				label: "Metric focus",
				type: "string_list",
				placeholder: "activity, sleep, heart rate",
			},
			{
				key: "summaryStyle",
				label: "Summary style",
				type: "textarea",
				placeholder: "Concise check-in, coaching tone, trend analysis, or alert thresholds",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "withings",
		title: "Withings",
		summary: "Review Withings body metrics, activity, devices, and sleep summaries from chat.",
		description:
			"Uses a connected Withings account to read profile, device, body measurement, activity, and sleep summary data without changing health records.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "withings",
				providerId: "withings",
				name: "Withings",
				description: "Reads profile, devices, body measurements, activity, and sleep summaries.",
				requiresConnection: true,
				operationIds: ["profile", "devices", "measurements", "activity", "sleep_summary"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about Withings data",
				description: "Ask Polychat to review Withings metrics, activity, devices, or sleep.",
			},
		],
		actions: [
			"Read connected Withings profile and device metadata",
			"Review body measurements, activity summaries, and sleep summaries",
			"Summarise wellness trends without medical diagnosis or safety-critical advice",
		],
		setupPrompt:
			"Set up the Withings recipe. Ask which metric types, date range, and summary style to use. Use only read-only Withings operations for profile, devices, measurements, activity, and sleep summaries. Do not edit goals, link or unlink devices, subscribe to notifications, change records, or present medical diagnosis or safety-critical advice.",
		configurationFields: [
			{
				key: "startDate",
				label: "Start date",
				type: "text",
				placeholder: "yyyy-MM-dd",
			},
			{
				key: "endDate",
				label: "End date",
				type: "text",
				placeholder: "yyyy-MM-dd",
			},
			{
				key: "metricFocus",
				label: "Metric focus",
				type: "string_list",
				placeholder: "weight, blood pressure, activity, sleep",
			},
			{
				key: "summaryStyle",
				label: "Summary style",
				type: "textarea",
				placeholder: "Concise trend summary, coaching tone, or threshold notes",
			},
			reviewInstructionsField,
		],
	},
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
	{
		id: "period-tracker",
		title: "Period Tracker",
		summary: "Log cycle, symptoms, mood, and flow notes into Notion.",
		description:
			"Uses a connected Notion workspace to save reviewed cycle log entries and produce non-medical summaries from user-provided notes.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 5,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "notion",
				providerId: "notion",
				name: "Notion",
				description:
					"Creates or appends private cycle log entries in a selected Notion page or database.",
				requiresConnection: true,
				operationIds: ["search", "create_page", "append_block_children"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Log a cycle note",
				description: "Ask Polychat to save symptoms, mood, flow, or cycle notes.",
			},
		],
		actions: [
			"Confirm the target Notion page or database",
			"Prepare reviewed cycle log entries",
			"Summarise patterns without medical claims",
		],
		setupPrompt:
			"Set up the Period Tracker recipe. Ask which private Notion page or database should store cycle entries, confirm which fields I want to track, and write entries only after I approve the exact content. Treat all cycle, symptom, mood, and flow notes as sensitive health data. Do not diagnose, predict medical conditions, or replace professional care.",
		configurationFields: [
			notionTargetField,
			{
				key: "trackedFields",
				label: "Tracked fields",
				type: "string_list",
				placeholder: "Flow, symptoms, mood, medication, notes",
			},
			{
				key: "privacyNotes",
				label: "Privacy notes",
				type: "textarea",
				placeholder: "Anything the assistant should avoid storing or summarising",
			},
		],
	},
	{
		id: "oura-recovery-check",
		title: "Oura Recovery Check",
		summary: "Review readiness, sleep, and activity trends from Oura.",
		description:
			"Uses connected Oura data to summarise recovery signals and practical non-medical next steps.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "oura",
				providerId: "oura",
				name: "Oura",
				description: "Reads daily readiness, sleep, and activity data.",
				requiresConnection: true,
				operationIds: ["daily_readiness", "daily_sleep", "daily_activity"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for recovery",
				description: "Ask Polychat to review recent Oura data.",
			},
			{
				type: "schedule",
				label: "Daily check",
				description: "Run a recurring recovery summary.",
			},
		],
		actions: [
			"Read recent readiness and sleep data",
			"Summarise trends and uncertainty",
			"Suggest practical non-medical adjustments",
		],
		setupPrompt:
			"Set up the Oura Recovery Check recipe. Review recent readiness, sleep, and activity data, flag uncertainty clearly, and avoid medical claims or diagnoses.",
		configurationFields: [
			{
				key: "dateRange",
				label: "Date range",
				type: "text",
				placeholder: "Last 7 days, yesterday, this week",
			},
			{
				key: "recoveryFocus",
				label: "Recovery focus",
				type: "textarea",
				placeholder: "Sleep consistency, readiness, activity balance, or practical next steps",
			},
		],
	},
	{
		id: "photo-nutrition-check",
		title: "Photo Nutrition Check",
		summary: "Review meal photos or labels sent in chat and turn them into practical notes.",
		description:
			"Uses Polychat's existing multimodal chat path for photos or labels without connecting a third-party service.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [],
		integrations: [],
		triggers: [
			{
				type: "message",
				label: "Send a meal photo",
				description: "Attach a photo or label in chat.",
			},
		],
		actions: [
			"Estimate the meal from visible details",
			"Flag uncertainty clearly",
			"Suggest simple adjustments",
		],
		setupPrompt:
			"Set up the Photo Nutrition Check recipe. Ask me to send a meal photo or label, estimate only what is visible, flag uncertainty clearly, and avoid medical claims.",
		configurationFields: [
			{
				key: "nutritionFocus",
				label: "Nutrition focus",
				type: "textarea",
				placeholder: "Protein, fibre, allergens, meal prep, or practical non-medical notes",
			},
			{
				key: "dietaryNotes",
				label: "Dietary notes",
				type: "textarea",
				placeholder: "Preferences, allergies, foods to avoid, or uncertainty rules",
			},
		],
	},
	{
		id: "birthday-gift-ideas",
		title: "Birthday Gift Ideas",
		summary: "Scan mail and calendars for upcoming birthdays and suggest gifts.",
		description:
			"Uses connected email and calendar accounts to spot upcoming birthdays, then prepares gift ideas for review.",
		kind: "automate",
		category: "Community",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL, WEB_SEARCH_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for birthday context when connected.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description:
					"Searches Outlook mail and calendar events for birthday context when connected.",
				requiresConnection: true,
				operationIds: ["search_messages", "list_events"],
			},
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Reads upcoming birthday events when connected.",
				requiresConnection: true,
				operationIds: ["list_events"],
			},
		],
		triggers: [
			{
				type: "schedule",
				label: "Weekly birthday scan",
				description: "Run a weekly scan for upcoming birthdays.",
			},
			{
				type: "message",
				label: "Ask for gift ideas",
				description: "Ask Polychat to prepare ideas for a specific person.",
			},
		],
		actions: [
			"Search upcoming calendar events and relevant mail",
			"Summarise the relationship and useful context",
			"Suggest practical gift ideas without purchasing anything",
		],
		setupPrompt:
			"Set up the Birthday Gift Ideas recipe. Ask which mail and calendar sources to use, how far ahead to scan, and any gift budget or categories to avoid. Use web search only for gift research, do not purchase anything, and ask before sending messages or changing calendars.",
		configurationFields: [
			{
				key: "scanWindow",
				label: "Scan window",
				type: "text",
				placeholder: "Next 14 days, next month",
			},
			{
				key: "giftBudget",
				label: "Gift budget",
				type: "text",
				placeholder: "Under GBP 50, handmade ideas, no budget",
			},
			reviewInstructionsField,
		],
	},
	{
		id: "monthly-subscription-audit",
		title: "Monthly Subscription Audit",
		summary: "Report active subscriptions, costs, renewals, and trial expirations.",
		description:
			"Uses connected mail to find subscription and billing messages, then creates a reviewable monthly spending report.",
		kind: "automate",
		category: "Finance",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for subscription and billing messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches Outlook for subscription and billing messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
		],
		triggers: [
			{
				type: "schedule",
				label: "Monthly audit",
				description: "Run a recurring subscription spending audit.",
			},
			{
				type: "message",
				label: "Ask for an audit",
				description: "Ask Polychat to review subscription messages now.",
			},
		],
		actions: [
			"Search for renewal, receipt, trial, and billing language",
			"Group likely subscriptions and billing dates",
			"Flag duplicates, price increases, and possible cancellations",
		],
		setupPrompt:
			"Set up the Monthly Subscription Audit recipe. Ask which inbox to scan, the review window, and whether to include trial, receipt, and renewal messages. Summarise likely subscriptions, costs, dates, and uncertainties. Do not cancel, send mail, or change accounts without explicit approval.",
		configurationFields: [
			{
				key: "mailProvider",
				label: "Mail provider",
				type: "text",
				required: true,
				placeholder: "Gmail or Outlook",
			},
			{
				key: "reviewWindow",
				label: "Review window",
				type: "text",
				placeholder: "This month, last 90 days, next 30 days",
			},
			{
				key: "currency",
				label: "Currency",
				type: "text",
				placeholder: "GBP, USD, EUR",
			},
		],
	},
	{
		id: "weekly-reading-suggestion",
		title: "Weekly Reading Suggestion",
		summary: "Suggest articles or books from recent interests and newsletters.",
		description:
			"Uses connected mail and web search to suggest reading material based on newsletters, projects, and recurring interests.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL, WEB_SEARCH_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches newsletters and reading-related Gmail messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches newsletters and reading-related Outlook messages.",
				requiresConnection: true,
				operationIds: ["search_messages"],
			},
		],
		triggers: [
			{
				type: "schedule",
				label: "Weekly suggestion",
				description: "Run a weekly reading recommendation.",
			},
		],
		actions: [
			"Identify recent topics from mail context",
			"Search for relevant articles or books",
			"Return a concise shortlist with reasons",
		],
		setupPrompt:
			"Set up the Weekly Reading Suggestion recipe. Ask which inbox or topics to use, preferred length and format, and any sources to avoid. Use mail context and web search to suggest reading, with links and short reasons. Do not subscribe, buy, or send anything.",
		configurationFields: [
			{
				key: "topics",
				label: "Topics",
				type: "string_list",
				placeholder: "AI, product, health, history",
			},
			{
				key: "preferredSources",
				label: "Preferred sources",
				type: "string_list",
				placeholder: "Blogs, papers, books, newsletters",
			},
		],
	},
	{
		id: "daily-ai-news-briefing",
		title: "Daily AI News Briefing",
		summary: "Get a concise daily briefing on major AI news.",
		description: "Uses web search to gather recent AI news and summarise the highest-signal items.",
		kind: "automate",
		category: "Developer",
		featured: false,
		estimatedSetupMinutes: 2,
		enabledTools: [WEB_SEARCH_TOOL],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Daily briefing",
				description: "Run a daily AI news scan.",
			},
			{
				type: "message",
				label: "Ask for news",
				description: "Ask Polychat for the latest AI news.",
			},
		],
		actions: [
			"Search recent AI news",
			"Deduplicate repeated stories",
			"Summarise important changes with links",
		],
		setupPrompt:
			"Set up the Daily AI News Briefing recipe. Ask for preferred topics, sources, and length. Use web search for recent AI news, cite sources in the answer, and separate confirmed facts from interpretation.",
		configurationFields: [
			{
				key: "topics",
				label: "Topics",
				type: "string_list",
				placeholder: "OpenAI, agents, regulation, chips, research",
			},
			{
				key: "briefingLength",
				label: "Briefing length",
				type: "text",
				placeholder: "3 bullets, concise, detailed",
			},
		],
	},
	{
		id: "did-you-know",
		title: "Did You Know?",
		summary: "Learn one interesting fact or topic with links to go deeper.",
		description:
			"Uses web search to prepare concise, sourced facts or mini-briefings for chat or scheduled delivery.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [WEB_SEARCH_TOOL],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Daily fact",
				description: "Run a recurring fact or topic briefing.",
			},
			{
				type: "message",
				label: "Ask for a fact",
				description: "Ask Polychat for an interesting fact or short explainer.",
			},
		],
		actions: [
			"Pick a topic from saved interests or the user's request",
			"Search for current supporting sources",
			"Return a short explanation with links for deeper reading",
		],
		setupPrompt:
			"Set up the Did You Know recipe. Ask for preferred topics, depth, and sources to avoid. Use web search to verify facts, cite links, and keep each briefing concise. Do not present uncertain claims as confirmed.",
		configurationFields: [
			{
				key: "topics",
				label: "Topics",
				type: "string_list",
				placeholder: "History, science, technology, language, everyday life",
			},
			{
				key: "readingLength",
				label: "Reading length",
				type: "text",
				placeholder: "One paragraph, 5-minute read, three bullets",
			},
		],
	},
	{
		id: "quick-qr-generator",
		title: "Quick QR Generator",
		summary: "Turn text, URLs, phone numbers, or Wi-Fi details into a scannable QR image.",
		description:
			"Builds a QR image URL from the user's supplied content and returns it for sharing in chat or SMS.",
		kind: "integrate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [QR_TOOL],
		integrations: [],
		triggers: [
			{
				type: "message",
				label: "Send QR content",
				description:
					"Ask Polychat to make a QR code for a URL, text, phone number, or Wi-Fi details.",
			},
		],
		actions: [
			"Confirm the exact payload to encode",
			"Build a QR image URL",
			"Return the QR image URL and the decoded payload for review",
		],
		setupPrompt:
			"Set up the Quick QR Generator recipe. Ask for the exact URL, text, phone number, email, or Wi-Fi payload to encode. Use the create_qr_code tool with the exact payload, return the generated QR image, and show the encoded payload for review. Do not invent or alter credentials, Wi-Fi passwords, phone numbers, or payment details.",
		configurationFields: [
			{
				key: "defaultSize",
				label: "Default size",
				type: "text",
				placeholder: "300x300",
			},
			{
				key: "qrNotes",
				label: "QR notes",
				type: "textarea",
				placeholder: "Preferred format, labels, or content to avoid encoding",
			},
		],
	},
	{
		id: "chonky-cat",
		title: "Chonky Cat",
		summary: "Generate a playful candid cat image from a short text request.",
		description:
			"Uses Polychat image generation to create a photorealistic candid cat image for chat or SMS delivery.",
		kind: "integrate",
		category: "Home",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [IMAGE_TOOL],
		integrations: [],
		triggers: [
			{
				type: "message",
				label: "Ask for a cat image",
				description: "Ask Polychat to generate a candid cat image.",
			},
		],
		actions: [
			"Confirm any style or scene details",
			"Generate a playful cat image",
			"Return the image without claiming it is a real pet photo",
		],
		setupPrompt:
			"Set up the Chonky Cat recipe. Ask for any scene, pose, or style preference, then use image generation to create a playful candid cat image. Keep it clearly synthetic and do not imply the generated image is a real pet photo.",
		configurationFields: [
			{
				key: "catStyle",
				label: "Cat style",
				type: "text",
				placeholder: "Photorealistic phone photo, cosy, funny, dramatic",
			},
			{
				key: "imageNotes",
				label: "Image notes",
				type: "textarea",
				placeholder: "Scene ideas, colours, or details to avoid",
			},
		],
	},
	{
		id: "journal",
		title: "Journal",
		summary: "Send journaling prompts and reflect on past entries in chat.",
		description:
			"Uses scheduled or manual chat prompts to support journaling without connecting a third-party service.",
		kind: "automate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Daily prompt",
				description: "Send a recurring journaling prompt.",
			},
			{
				type: "message",
				label: "Journal in chat",
				description: "Ask Polychat for a prompt or reflection.",
			},
		],
		actions: [
			"Ask a concise reflection question",
			"Adapt prompts to saved preferences",
			"Keep tone supportive without clinical claims",
		],
		setupPrompt:
			"Set up the Journal recipe. Ask what kind of prompts I want, preferred cadence, and any topics to avoid. Keep responses private, reflective, and non-clinical. Do not infer diagnoses or expose past entries unless I ask.",
		configurationFields: [
			{
				key: "journalStyle",
				label: "Journal style",
				type: "text",
				placeholder: "Gratitude, work reflection, mood, free-form",
			},
			{
				key: "topicsToAvoid",
				label: "Topics to avoid",
				type: "string_list",
				placeholder: "Work, relationships, health",
			},
		],
	},
	{
		id: "hydration-reminders",
		title: "Hydration Reminders",
		summary: "Send friendly water reminders throughout the day.",
		description:
			"Uses scheduled recipe prompts and optional SMS delivery for lightweight hydration reminders.",
		kind: "automate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Reminder schedule",
				description: "Run recurring reminders during preferred hours.",
			},
		],
		actions: [
			"Send a short reminder",
			"Vary wording to avoid repetition",
			"Respect saved quiet hours and tone",
		],
		setupPrompt:
			"Set up the Hydration Reminders recipe. Ask for reminder times, quiet hours, tone, and whether scheduled results should be sent by SMS. Keep messages short and avoid medical claims.",
		configurationFields: [
			{
				key: "quietHours",
				label: "Quiet hours",
				type: "text",
				placeholder: "After 21:00, before 08:00",
			},
			{
				key: "tone",
				label: "Tone",
				type: "text",
				placeholder: "Direct, gentle, funny, minimal",
			},
		],
	},
	{
		id: "nightly-gratitude",
		title: "Nightly Gratitude",
		summary: "Receive an evening reflection prompt to wind down.",
		description: "Uses scheduled recipe prompts to generate varied gratitude reflections.",
		kind: "automate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Nightly prompt",
				description: "Run a recurring evening gratitude prompt.",
			},
		],
		actions: [
			"Generate a short gratitude prompt",
			"Vary phrasing over time",
			"Keep the tone calm and non-clinical",
		],
		setupPrompt:
			"Set up the Nightly Gratitude recipe. Ask what time I want prompts, tone preferences, and any topics to avoid. Keep messages concise and reflective, not therapeutic or diagnostic.",
		configurationFields: [
			{
				key: "promptStyle",
				label: "Prompt style",
				type: "text",
				placeholder: "Simple, specific, reflective, playful",
			},
		],
	},
	{
		id: "rent-reminders",
		title: "Rent Reminders",
		summary: "Send a reminder before rent or household bills are due.",
		description:
			"Uses scheduled recipe prompts and optional SMS delivery for recurring bill reminders.",
		kind: "automate",
		category: "Finance",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Monthly reminder",
				description: "Run before the configured due date.",
			},
		],
		actions: [
			"Send a concise reminder",
			"Include amount or account notes if saved",
			"Avoid implying payment was made",
		],
		setupPrompt:
			"Set up the Rent Reminders recipe. Ask for due date, reminder timing, amount or notes to include, and whether scheduled results should be sent by SMS. Do not claim a payment was made or access financial accounts.",
		configurationFields: [
			{
				key: "dueDate",
				label: "Due date",
				type: "text",
				required: true,
				placeholder: "1st of each month, last weekday",
			},
			{
				key: "reminderLeadTime",
				label: "Reminder lead time",
				type: "text",
				placeholder: "3 days before, morning of",
			},
			{
				key: "paymentNotes",
				label: "Payment notes",
				type: "textarea",
				placeholder: "Amount, reference, or account nickname",
			},
		],
	},
	{
		id: "weekly-productivity-check-in",
		title: "Weekly Productivity Check-in",
		summary: "Review wins, blockers, and priorities at the end of the week.",
		description: "Uses scheduled recipe prompts to help reflect on the week and plan the next one.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 1,
		enabledTools: [],
		integrations: [],
		triggers: [
			{
				type: "schedule",
				label: "Weekly check-in",
				description: "Run at the end of each week.",
			},
			{
				type: "message",
				label: "Ask for a check-in",
				description: "Ask Polychat to run a productivity reflection now.",
			},
		],
		actions: [
			"Ask about wins, blockers, and next priorities",
			"Keep the prompt concise",
			"Use saved work style preferences",
		],
		setupPrompt:
			"Set up the Weekly Productivity Check-in recipe. Ask which day and time to run, what areas to reflect on, and preferred tone. Keep the output concise and ask follow-up questions rather than inventing accomplishments.",
		configurationFields: [
			{
				key: "focusAreas",
				label: "Focus areas",
				type: "string_list",
				placeholder: "Work, health, learning, relationships",
			},
			{
				key: "checkInTone",
				label: "Check-in tone",
				type: "text",
				placeholder: "Direct, encouraging, analytical",
			},
		],
	},
	{
		id: "daily-weather",
		title: "Daily Weather",
		summary: "Get a local forecast with practical planning notes.",
		description:
			"Uses Polychat's weather tool to prepare a local forecast with temperature, conditions, and practical suggestions.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 2,
		enabledTools: [WEATHER_TOOL],
		integrations: [],
		triggers: [
			{
				type: "message",
				label: "Ask for weather",
				description: "Ask Polychat for a forecast for a saved or supplied location.",
			},
			{
				type: "schedule",
				label: "Daily forecast",
				description: "Run a recurring local forecast.",
			},
		],
		actions: [
			"Look up current weather for the configured location",
			"Summarise temperature and conditions",
			"Suggest practical non-critical planning notes",
		],
		setupPrompt:
			"Set up the Daily Weather recipe. Ask for the location or coordinates to use, save any preferred forecast timing in the recipe configuration, and use the weather tool to summarise conditions. Avoid safety-critical guarantees and ask for clarification if the location is ambiguous.",
		configurationFields: [
			locationField,
			{
				key: "forecastTime",
				label: "Forecast time",
				type: "text",
				placeholder: "07:30 local time, before commute, evening",
			},
			{
				key: "units",
				label: "Units",
				type: "text",
				placeholder: "Celsius or Fahrenheit",
			},
		],
	},
	{
		id: "bad-weather-alerts",
		title: "Bad Weather Alerts",
		summary: "Check for rain, snow, storms, or heat before the day starts.",
		description:
			"Uses Polychat's weather tool to prepare practical alerts for likely disruptive weather.",
		kind: "automate",
		category: "Productivity",
		featured: false,
		estimatedSetupMinutes: 2,
		enabledTools: [WEATHER_TOOL],
		integrations: [],
		triggers: [
			{
				type: "message",
				label: "Ask about bad weather",
				description: "Ask Polychat whether today's weather needs extra preparation.",
			},
			{
				type: "schedule",
				label: "Morning alert",
				description: "Run a recurring morning weather check.",
			},
		],
		actions: [
			"Look up weather for the configured location",
			"Flag likely rain, snow, storms, or heat",
			"Suggest practical reminders like umbrella, layers, or sunscreen",
		],
		setupPrompt:
			"Set up the Bad Weather Alerts recipe. Ask for the location or coordinates, preferred alert threshold, and morning schedule. Use the weather tool for conditions and keep recommendations practical rather than safety-critical.",
		configurationFields: [
			locationField,
			{
				key: "alertThresholds",
				label: "Alert thresholds",
				type: "string_list",
				placeholder: "Rain, snow, storms, heat above 30C",
			},
			{
				key: "forecastTime",
				label: "Forecast time",
				type: "text",
				placeholder: "07:00 local time, before school run, before commute",
			},
		],
	},
	{
		id: "london-weather-comparison",
		title: "London Weather Comparison",
		summary: "Compare your local weather with London each morning.",
		description:
			"Uses Polychat's weather tool to compare a saved local forecast against London, United Kingdom with practical context.",
		kind: "automate",
		category: "Community",
		featured: false,
		estimatedSetupMinutes: 2,
		enabledTools: [WEATHER_TOOL],
		integrations: [],
		triggers: [
			{
				type: "message",
				label: "Ask for comparison",
				description: "Ask Polychat to compare your weather with London.",
			},
			{
				type: "schedule",
				label: "Daily comparison",
				description: "Run a recurring morning weather comparison.",
			},
		],
		actions: [
			"Look up weather for the configured location",
			"Look up weather for London, United Kingdom",
			"Compare temperature, conditions, and practical planning notes",
		],
		setupPrompt:
			"Set up the London Weather Comparison recipe. Ask for my local location or coordinates, preferred forecast time, and tone. Use the weather tool for both my location and London, United Kingdom. Keep the comparison practical and light, avoid safety-critical guarantees, and ask for clarification if my location is ambiguous.",
		configurationFields: [
			locationField,
			{
				key: "forecastTime",
				label: "Forecast time",
				type: "text",
				placeholder: "07:30 local time, before commute, morning",
			},
			{
				key: "comparisonTone",
				label: "Comparison tone",
				type: "text",
				placeholder: "Dry, playful, concise, practical",
			},
		],
	},
];

export const assistantRecipes: AssistantRecipe[] = catalogRecipes.map((recipe) => ({
	...recipe,
	configurationFields: (recipe.configurationFields ?? []).map((field) => ({
		required: false,
		...field,
	})),
}));

export function getRecipeCatalogValidationIssues(
	recipes: readonly AssistantRecipe[] = assistantRecipes,
): string[] {
	const issues: string[] = [];

	for (const recipe of recipes) {
		const hasScheduleTrigger = recipe.triggers.some((trigger) => trigger.type === "schedule");

		for (const integration of recipe.integrations) {
			const provider = recipeConnectorProviderSchema.safeParse(integration.providerId);
			if (!provider.success || provider.data === "github") {
				continue;
			}

			for (const operationId of integration.operationIds ?? []) {
				if (!isConnectorOperationSupported(provider.data, operationId)) {
					issues.push(
						`${recipe.id}:${integration.id} declares unsupported ${provider.data}.${operationId}`,
					);
					continue;
				}

				if (hasScheduleTrigger && isConnectorOperationWrite(provider.data, operationId)) {
					issues.push(
						`${recipe.id}:${integration.id} declares scheduled write operation ${provider.data}.${operationId}`,
					);
				}
			}
		}
	}

	return issues;
}

export const recipeFilters: RecipeKind[] = ["automate", "integrate"];

export const recipeCategories: RecipeCategory[] = Array.from(
	new Set(assistantRecipes.map((recipe) => recipe.category)),
).sort((a, b) => a.localeCompare(b)) as RecipeCategory[];
