import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

export const healthConnectorRecipes: CatalogRecipe[] = [
	{
		id: "strava-training-review",
		title: "Strava Training Review",
		summary: "Review activities, training totals, zones, and routes from Strava.",
		description:
			"Uses a connected Strava account to inspect activity and training data, while keeping activity creation and profile changes out of this recipe.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 3,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "strava",
				providerId: "strava",
				name: "Strava",
				description: "Reads athlete, activity, training, route, segment, and zone data.",
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
				],
			},
		],
		triggers: [
			{
				type: "message",
				label: "Ask about training",
				description: "Ask Polychat to review recent Strava activity and training data.",
			},
			{
				type: "schedule",
				label: "Weekly training review",
				description: "Run a recurring read-only training summary.",
			},
		],
		actions: [
			"Review recent activities and detailed streams",
			"Compare training totals and heart-rate or power zones",
			"Summarise routes and trends without medical claims",
		],
		setupPrompt:
			"Set up the Strava Training Review recipe. Ask which dates, activity types, metrics, and comparison period to use. Use only the enabled read operations. Do not create, upload, edit, star, or otherwise mutate Strava data in this recipe. Flag uncertainty and avoid medical diagnosis.",
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
			reviewInstructionsField,
		],
	},
	{
		id: "strava-activity-operations",
		title: "Strava Activity Operations",
		summary: "Create and upload activities, update athlete settings, and manage starred segments.",
		description:
			"Uses Strava activity creation and upload, upload status, athlete updates, segment discovery, and segment starring alongside activity reads.",
		kind: "integrate",
		category: "Health",
		featured: false,
		estimatedSetupMinutes: 4,
		enabledTools: [RECIPE_CONNECTOR_TOOL],
		integrations: [
			{
				id: "strava",
				providerId: "strava",
				name: "Strava",
				description: "Creates and uploads activities and maintains athlete and segment state.",
				requiresConnection: true,
				operationIds: [
					"STRAVA_GET_AUTHENTICATED_ATHLETE",
					"STRAVA_LIST_ATHLETE_ACTIVITIES",
					"STRAVA_GET_ACTIVITY",
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
				label: "Manage an activity or segment",
				description: "Create, upload, or update reviewed Strava data.",
			},
		],
		actions: [
			"Create a manual activity or upload an activity file and verify processing",
			"Review and update athlete settings",
			"Explore and star or unstar segments after confirmation",
		],
		setupPrompt:
			"Set up Strava Activity Operations. Ask for activity units, privacy preferences, upload formats, athlete settings, and segment interests. Show exact activity details before creating or uploading. Confirm athlete setting and segment star changes before applying them. Never invent activity data.",
		configurationFields: [
			{
				key: "activityDefaults",
				label: "Activity defaults",
				type: "textarea",
				placeholder: "Sport type, units, privacy, commute, trainer, and naming",
			},
			{
				key: "segmentInterests",
				label: "Segment interests",
				type: "string_list",
				placeholder: "Locations, climbs, routes, or segments",
			},
			reviewInstructionsField,
		],
	},
];
