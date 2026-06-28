import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, notionTargetField } from "./shared";

export const wellbeingRecipes: CatalogRecipe[] = [
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
];
