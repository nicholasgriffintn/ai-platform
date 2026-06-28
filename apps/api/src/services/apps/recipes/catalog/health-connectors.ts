import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

export const healthConnectorRecipes: CatalogRecipe[] = [
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
];
