import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, preferredConnectorsField, reviewInstructionsField } from "./shared";

export const mailCalendarRecipes: CatalogRecipe[] = [
	{
		id: "morning-briefing",
		title: "Morning Briefing",
		summary: "Summarise your calendar, priority emails, and likely focus areas.",
		description:
			"Uses whichever connected mail and calendar accounts you have to prepare a daily briefing that can be started manually, scheduled, or requested in chat.",
		kind: "automate",
		category: "Productivity",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Reads relevant recent messages when Gmail is connected.",
				requiresConnection: true,
				connectionGroup: "sources",
				operationIds: ["GMAIL_FETCH_EMAILS"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description:
					"Reads relevant recent mail and upcoming calendar events when Outlook is connected.",
				requiresConnection: true,
				connectionGroup: "sources",
				operationIds: ["OUTLOOK_SEARCH_MESSAGES", "OUTLOOK_GET_CALENDAR_VIEW"],
			},
			{
				id: "googlecalendar",
				providerId: "googlecalendar",
				name: "Google Calendar",
				description: "Reads upcoming calendar events when Google Calendar is connected.",
				requiresConnection: true,
				connectionGroup: "sources",
				operationIds: ["GOOGLECALENDAR_EVENTS_LIST"],
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
			"Read upcoming calendar events from connected calendars",
			"Search connected inboxes for recent priority emails",
			"Summarise blockers, commitments, and suggested next steps",
		],
		setupPrompt:
			"Set up the Morning Briefing recipe. Use every connected mail and calendar source unless I say otherwise, ask what time the briefing should run if I want a schedule, then prepare a concise briefing. Ask before marking, sending, or changing anything externally.",
		configurationFields: [
			preferredConnectorsField,
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
			"Searches connected mail for deadline-style messages and creates events in your connected calendar only after the user confirms the proposed event details.",
		kind: "automate",
		category: "Students",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for deadline messages.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["GMAIL_FETCH_EMAILS"],
			},
			{
				id: "outlook-mail",
				providerId: "outlook",
				name: "Outlook Mail",
				description: "Searches Outlook mail for deadline messages.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["OUTLOOK_SEARCH_MESSAGES"],
			},
			{
				id: "googlecalendar",
				providerId: "googlecalendar",
				name: "Google Calendar",
				description: "Creates reviewed deadline events.",
				requiresConnection: true,
				connectionGroup: "calendar",
				operationIds: ["GOOGLECALENDAR_CREATE_EVENT"],
			},
			{
				id: "outlook-calendar",
				providerId: "outlook",
				name: "Outlook Calendar",
				description: "Creates reviewed deadline events in Outlook.",
				requiresConnection: true,
				connectionGroup: "calendar",
				operationIds: ["OUTLOOK_CALENDAR_CREATE_EVENT"],
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
			"Set up the Add Deadlines to Calendar recipe. Use the connected mail and calendar services, search for deadline emails, propose events with confidence and source links, and create events only after I approve each one.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "calendarTarget",
				label: "Calendar target",
				type: "text",
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
			"Searches connected mail for flight confirmations, extracts itinerary details, and creates reviewed events in your connected calendar after confirmation.",
		kind: "automate",
		category: "Travel",
		featured: true,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for flight confirmation and itinerary messages.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["GMAIL_FETCH_EMAILS"],
			},
			{
				id: "outlook-mail",
				providerId: "outlook",
				name: "Outlook Mail",
				description: "Searches Outlook mail for flight itineraries.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["OUTLOOK_SEARCH_MESSAGES"],
			},
			{
				id: "googlecalendar",
				providerId: "googlecalendar",
				name: "Google Calendar",
				description: "Creates reviewed flight calendar events.",
				requiresConnection: true,
				connectionGroup: "calendar",
				operationIds: ["GOOGLECALENDAR_CREATE_EVENT"],
			},
			{
				id: "outlook-calendar",
				providerId: "outlook",
				name: "Outlook Calendar",
				description: "Creates reviewed flight calendar events in Outlook.",
				requiresConnection: true,
				connectionGroup: "calendar",
				operationIds: ["OUTLOOK_CALENDAR_CREATE_EVENT"],
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
			"Set up the Add Flights to Calendar recipe. Use the connected mail and calendar services, search for flight confirmations and itineraries, extract flight numbers, airports, local departure and arrival times, confirmation codes, and source links, then create calendar events only after I approve each event. Do not check in, contact airlines, or change bookings.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "calendarTarget",
				label: "Calendar target",
				type: "text",
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
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches sent Gmail conversations and creates draft follow-ups.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["GMAIL_FETCH_EMAILS", "GMAIL_CREATE_EMAIL_DRAFT"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches sent Outlook conversations and creates draft follow-ups.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["OUTLOOK_SEARCH_MESSAGES", "OUTLOOK_CREATE_DRAFT"],
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
			"Set up the Follow-up Reminders recipe. Use the connected mail services, find likely unreplied sent messages, explain why each candidate matters, and create follow-up drafts only when I confirm.",
		configurationFields: [
			preferredConnectorsField,
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
		summary: "Track subscriptions, renewals, trials, and billing across connected mail.",
		description:
			"Uses connected mail search to identify active subscriptions, upcoming renewals, trial expirations, and price changes, then produces a reviewable spending summary.",
		kind: "automate",
		category: "Finance",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "gmail",
				providerId: "gmail",
				name: "Gmail",
				description: "Searches Gmail for subscription, renewal, trial, and billing messages.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["GMAIL_FETCH_EMAILS"],
			},
			{
				id: "outlook",
				providerId: "outlook",
				name: "Outlook",
				description: "Searches Outlook for subscription, renewal, trial, and billing messages.",
				requiresConnection: true,
				connectionGroup: "mail",
				operationIds: ["OUTLOOK_SEARCH_MESSAGES"],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask for an audit",
				description: "Ask Polychat to review subscription and billing messages.",
			},
			{
				type: "schedule",
				label: "Monthly audit",
				description: "Run a recurring subscription spending audit.",
			},
		],
		actions: [
			"Search for renewal, receipt, trial, and billing language",
			"Group likely subscriptions with costs and billing dates",
			"Flag duplicates, price increases, expiring trials, and cancellation next steps",
		],
		setupPrompt:
			"Set up the Subscription Watchdog recipe. Use the connected mail services, search for subscriptions, renewals, trials, and receipts, then summarise likely charges, price changes, and cancellation next steps with uncertainties flagged. Do not cancel, send mail, or change accounts without explicit approval.",
		configurationFields: [
			preferredConnectorsField,
			{
				key: "reviewWindow",
				label: "Review window",
				type: "text",
				placeholder: "Next 30 days, this month, last 90 days",
			},
			{
				key: "currency",
				label: "Currency",
				type: "text",
				placeholder: "GBP, USD, EUR",
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
