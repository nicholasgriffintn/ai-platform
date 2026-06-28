import type { CatalogRecipe } from "./shared";
import {
	RECIPE_CONNECTOR_TOOL,
	WEATHER_TOOL,
	WEB_SEARCH_TOOL,
	IMAGE_TOOL,
	QR_TOOL,
	reviewInstructionsField,
	locationField,
} from "./shared";

export const personalUtilityRecipes: CatalogRecipe[] = [
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
