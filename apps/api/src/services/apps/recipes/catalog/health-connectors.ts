import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

export const healthConnectorRecipes: CatalogRecipe[] = [
	{
		id: "fitness-tracking",
		title: "Fitness Tracking",
		summary: "Review training data and manage activities in your connected fitness service.",
		description:
			"Uses a connected Strava account to review activities, training totals, zones, and routes, and to create, upload, or update reviewed activity data from chat.",
		kind: "integrate",
		category: "Health",
		featured: false,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "strava",
				providerId: "strava",
				name: "Strava",
				description:
					"Reads athlete, activity, training, route, segment, and zone data and applies reviewed activity, athlete, and segment changes.",
				requiresConnection: true,
				operationIds: [
					"STRAVA_GET_AUTHENTICATED_ATHLETE",
					"STRAVA_LIST_ATHLETE_ACTIVITIES",
					"STRAVA_GET_ACTIVITY",
					"STRAVA_GET_ACTIVITY_STREAMS",
					"STRAVA_GET_ACTIVITY_ZONES",
					"STRAVA_GET_ATHLETE_STATS",
					"STRAVA_GET_ATHLETE_ZONES",
					"STRAVA_LIST_ATHLETE_ROUTES",
					"STRAVA_CREATE_AN_ACTIVITY",
					"STRAVA_UPLOAD_ACTIVITY",
					"STRAVA_GET_UPLOAD",
					"STRAVA_UPDATE_ATHLETE",
					"STRAVA_EXPLORE_SEGMENTS",
					"STRAVA_GET_SEGMENT",
					"STRAVA_LIST_STARRED_SEGMENTS",
					"STRAVA_STAR_SEGMENT",
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about training",
				description: "Review training data or manage reviewed activities and segments.",
			},
			{
				type: "schedule",
				label: "Recurring training review",
				description: "Run a recurring read-only training summary.",
			},
		],
		actions: [
			"Review recent activities, streams, training totals, and heart-rate or power zones",
			"Create a manual activity or upload an activity file and verify processing",
			"Update athlete settings and star segments only after confirmation",
		],
		setupPrompt:
			"Set up the Fitness Tracking recipe. Ask which dates, activity types, metrics, and comparison period matter, plus activity units, privacy preferences, and segment interests. Scheduled runs are read-only summaries. Show exact details before creating, uploading, or updating anything and confirm every change. Never invent activity data, flag uncertainty, and avoid medical diagnosis.",
		configurationFields: [
			{
				key: "dateRange",
				label: "Date range",
				type: "text",
				placeholder: "Last 7 days, this month, or since a date",
			},
			{
				key: "activityTypes",
				label: "Activity types",
				type: "string_list",
				placeholder: "Run, Ride, Swim",
			},
			{
				key: "trainingFocus",
				label: "Training focus",
				type: "textarea",
				placeholder: "Volume, intensity, zones, consistency, or route comparison",
			},
			{
				key: "activityDefaults",
				label: "Activity defaults",
				type: "textarea",
				placeholder: "Sport type, units, privacy, commute, trainer, and naming",
			},
			reviewInstructionsField,
		],
	},
];
