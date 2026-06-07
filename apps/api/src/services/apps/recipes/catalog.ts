import type {
	AssistantRecipe,
	RecipeCategory,
	RecipeConfigurationField,
	RecipeKind,
} from "@assistant/schemas";

export const RECIPE_CONNECTOR_TOOL = "use_recipe_connector";
export const RECIPE_TRIGGER_TOOL = "trigger_recipe";
export const WEATHER_TOOL = "get_weather";

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
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Reads relevant recent mail and calendar data when Outlook is connected.",
				requiresConnection: true,
			},
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Reads upcoming calendar events when Google Calendar is connected.",
				requiresConnection: true,
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
			"Searches connected mail for deadline-style messages and creates calendar events only after the user confirms the proposed event details.",
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
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches Outlook mail for deadline messages.",
				requiresConnection: true,
			},
			{
				id: "calendar",
				providerId: "calendar",
				name: "Google Calendar",
				description: "Creates reviewed deadline events.",
				requiresConnection: true,
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for deadline extraction",
				description: "Ask Polychat to scan for deadlines and propose events.",
			},
			{
				type: "schedule",
				label: "Recurring scan",
				description: "Run a recurring deadline scan.",
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
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches sent Outlook conversations.",
				requiresConnection: true,
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for follow-ups",
				description: "Ask Polychat to find follow-up candidates.",
			},
			{
				type: "schedule",
				label: "Daily scan",
				description: "Run a scheduled follow-up scan.",
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
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches Outlook for renewal and trial messages.",
				requiresConnection: true,
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
			"Set up the Linear Triage recipe. Ask which team or project to use, search issues as needed, and create or update issues only after I confirm the exact changes.",
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
			},
		],
		triggers: [
			{
				type: "message",
				label: "Log a note",
				description: "Ask Polychat to capture a decision, action item, or recap.",
			},
			{
				type: "schedule",
				label: "Weekly recap",
				description: "Run a recurring recap into Notion.",
			},
		],
		actions: [
			"Find the configured Notion log page or database",
			"Prepare decision and action-item notes",
			"Append or create entries after confirmation",
		],
		setupPrompt:
			"Set up the Notion Action Log recipe. Ask which Notion page or database should store action logs, confirm the format for decisions and follow-ups, and write to Notion only after I approve the entry or recurring recap target.",
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
		integrations: [
			{
				id: "chat-vision",
				providerId: "chat",
				name: "Chat image input",
				description: "Uses images you send directly in Polychat.",
				requiresConnection: false,
			},
		],
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
		integrations: [
			{
				id: "weather",
				providerId: "chat",
				name: "Weather",
				description: "Uses the built-in weather lookup tool.",
				requiresConnection: false,
			},
		],
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
		integrations: [
			{
				id: "weather",
				providerId: "chat",
				name: "Weather",
				description: "Uses the built-in weather lookup tool.",
				requiresConnection: false,
			},
		],
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
];

export const assistantRecipes: AssistantRecipe[] = catalogRecipes.map((recipe) => ({
	...recipe,
	configurationFields: (recipe.configurationFields ?? []).map((field) => ({
		required: false,
		...field,
	})),
}));

export const recipeFilters: RecipeKind[] = ["automate", "integrate"];

export const recipeCategories: RecipeCategory[] = Array.from(
	new Set(assistantRecipes.map((recipe) => recipe.category)),
).sort((a, b) => a.localeCompare(b)) as RecipeCategory[];
