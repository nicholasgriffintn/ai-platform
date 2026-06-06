import type { AssistantRecipe, RecipeCategory, RecipeKind } from "@assistant/schemas";

export const recipeCategories: RecipeCategory[] = [
	"Calendar",
	"Community",
	"Developer",
	"Email",
	"Finance",
	"Health",
	"Home",
	"Productivity",
	"Scheduling",
	"Shopping",
	"Students",
	"To-dos",
	"Travel",
];

export const recipeFilters: RecipeKind[] = ["automate", "integrate"];

export const assistantRecipes: AssistantRecipe[] = [
	{
		id: "inbox-chief-of-staff",
		title: "Inbox chief of staff",
		summary: "Summarise important email, draft replies, and text you when something needs action.",
		description:
			"Connect Gmail or Outlook and let your assistant triage urgent threads, prepare replies in your voice, and keep your inbox from becoming another app you have to babysit.",
		kind: "automate",
		category: "Email",
		featured: true,
		estimatedSetupMinutes: 3,
		integrations: [
			{
				id: "gmail",
				name: "Gmail",
				description: "Search, label, draft, and send email once connected.",
				requiresConnection: true,
			},
			{
				id: "outlook",
				name: "Outlook",
				description: "Use inbox, calendar, and contacts from Microsoft accounts.",
				requiresConnection: true,
			},
		],
		triggers: [
			{
				type: "event",
				label: "Important message arrives",
				description: "The assistant watches for senders, keywords, and deadlines you approve.",
			},
			{
				type: "message",
				label: "Text a request",
				description: "Ask for a summary, draft, or follow-up from chat or iOS.",
			},
		],
		actions: [
			"Build an inbox brief with action items",
			"Draft replies and ask before sending",
			"Create reminders for unanswered threads",
		],
		setupPrompt:
			"Set up the Inbox chief of staff recipe. Help me connect Gmail or Outlook, decide what counts as important, choose when to text me, and create a safe approval flow before anything is sent.",
	},
	{
		id: "meeting-to-calendar",
		title: "Meeting action items",
		summary: "Turn meeting notes into calendar blocks, reminders, and follow-up drafts.",
		description:
			"Paste notes or connect your meeting workflow so your assistant can extract decisions, owners, and due dates, then schedule the next steps while the context is fresh.",
		kind: "automate",
		category: "Calendar",
		featured: true,
		estimatedSetupMinutes: 2,
		integrations: [
			{
				id: "calendar",
				name: "Calendar",
				description: "Create events, focus blocks, and reminders.",
				requiresConnection: true,
			},
			{
				id: "notes",
				name: "Notes",
				description: "Use pasted notes, uploaded docs, or connected note apps.",
				requiresConnection: false,
			},
		],
		triggers: [
			{
				type: "message",
				label: "Send notes",
				description: "Share a transcript, bullet list, or quick recap with the assistant.",
			},
		],
		actions: [
			"Extract action items with owners and due dates",
			"Create calendar holds for next steps",
			"Draft follow-up messages for review",
		],
		setupPrompt:
			"Set up the Meeting action items recipe. Ask me what calendar to use, how to format action items, and whether you should draft follow-ups, reminders, or both after I send meeting notes.",
	},
	{
		id: "health-daily-coach",
		title: "Daily health coach",
		summary: "Combine wearable, meal, and habit signals into a friendly daily plan.",
		description:
			"Bring sleep, activity, nutrition, and goals into one conversational assistant that can nudge you at the right time without making health feel like a dashboard chore.",
		kind: "integrate",
		category: "Health",
		featured: true,
		estimatedSetupMinutes: 4,
		integrations: [
			{
				id: "oura",
				name: "Oura",
				description: "Readiness, sleep, and activity insights.",
				requiresConnection: true,
			},
			{
				id: "vision",
				name: "Photo nutrition",
				description: "Estimate meals from photos or labels you send.",
				requiresConnection: false,
			},
		],
		triggers: [
			{
				type: "schedule",
				label: "Morning and evening check-ins",
				description: "Choose the windows when coaching is welcome.",
			},
			{
				type: "message",
				label: "Send a meal photo",
				description: "Ask for nutrition, macros, or a quick adjustment.",
			},
		],
		actions: [
			"Summarise readiness and sleep trends",
			"Suggest recovery-aware workouts",
			"Track meals from text, photos, or labels",
		],
		setupPrompt:
			"Set up the Daily health coach recipe. Help me connect wearable data if available, define my goals, pick check-in times, and decide how you should respond to meal photos or nutrition labels.",
	},
	{
		id: "developer-standup",
		title: "Developer standup",
		summary: "Summarise GitHub and Linear changes, blockers, and pull requests before standup.",
		description:
			"Give your assistant access to the developer systems you already use so it can produce a concise standup brief and proactively flag stale reviews or blocked issues.",
		kind: "integrate",
		category: "Developer",
		featured: true,
		estimatedSetupMinutes: 5,
		integrations: [
			{
				id: "github",
				name: "GitHub",
				description: "Issues, pull requests, reviews, and repository activity.",
				requiresConnection: true,
			},
			{
				id: "linear",
				name: "Linear",
				description: "Issues, cycles, projects, and team status.",
				requiresConnection: true,
			},
		],
		triggers: [
			{
				type: "schedule",
				label: "Before standup",
				description: "Run on weekdays at the time you choose.",
			},
		],
		actions: [
			"Summarise merged PRs and open reviews",
			"Identify blocked Linear issues",
			"Draft a standup update in your style",
		],
		setupPrompt:
			"Set up the Developer standup recipe. Help me connect GitHub and Linear, choose repositories and teams, set a weekday standup time, and define the format for my daily update.",
	},
	{
		id: "travel-concierge",
		title: "Travel concierge",
		summary: "Track reservations, check-in windows, packing reminders, and itinerary changes.",
		description:
			"Forward confirmations or connect email and calendar so your assistant can maintain a living itinerary and text you when travel details change.",
		kind: "automate",
		category: "Travel",
		featured: false,
		estimatedSetupMinutes: 3,
		integrations: [
			{
				id: "email",
				name: "Email",
				description: "Find flight, hotel, and reservation confirmations.",
				requiresConnection: true,
			},
			{
				id: "calendar",
				name: "Calendar",
				description: "Add itinerary holds and reminders.",
				requiresConnection: true,
			},
		],
		triggers: [
			{
				type: "event",
				label: "Trip event changes",
				description: "Monitor check-in, departure, and reservation windows.",
			},
		],
		actions: [
			"Build a live itinerary",
			"Create packing and check-in reminders",
			"Text changes that need attention",
		],
		setupPrompt:
			"Set up the Travel concierge recipe. Ask me what trip to plan for, where to look for confirmations, when to text me, and which calendar reminders to create.",
	},
];

export function getRecipeById(id: string) {
	return assistantRecipes.find((recipe) => recipe.id === id);
}

export function createRecipeMessageUrl(setupPrompt: string) {
	return `/?query=${encodeURIComponent(setupPrompt)}`;
}
