import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

export const mailCalendarRecipes: CatalogRecipe[] = [
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
];
