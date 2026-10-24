import type { CatalogRecipe } from "./shared";
import { RECIPE_CONNECTOR_TOOL, reviewInstructionsField } from "./shared";

export const healthConnectorRecipes: CatalogRecipe[] = [
  {
    id: "fitness-tracking",
    title: "Fitness Tracking",
    summary: "Review training, sleep and recovery from whichever fitness service you connect.",
    description:
      "Uses whichever fitness service you have connected to review activity, sleep and recovery and how they change over time. It only reads.",
    kind: "integrate",
    category: "Health",
    featured: false,
    enabledTools: [RECIPE_CONNECTOR_TOOL],
    integrations: [
      {
        id: "oura",
        providerId: "oura",
        name: "Oura",
        description: "Reads daily readiness, sleep and activity scores.",
        requiresConnection: true,
        connectionGroup: "fitness",
        operationIds: ["get_daily_readiness", "get_daily_sleep", "get_daily_activity"],
      },
    ],
    triggers: [
      {
        type: "message",
        label: "Ask about training",
        description: "Review activity, sleep and recovery for any period.",
      },
      {
        type: "schedule",
        label: "Recurring training review",
        description: "Run a recurring read-only summary.",
      },
    ],
    actions: [
      "Review activity, sleep and recovery for the chosen period from the connected fitness service",
      "Compare the period with the one before and point out clear changes",
      "Flag gaps in the data rather than filling them in",
    ],
    setupPrompt:
      "Set up the Fitness Tracking recipe. Ask which dates and metrics matter and what to compare against. It only reads. Never invent data, flag uncertainty, and avoid medical diagnosis.",
    configurationFields: [
      {
        key: "dateRange",
        label: "Date range",
        type: "text",
        placeholder: "Last 7 days, this month, or since a date",
      },
      {
        key: "trainingFocus",
        label: "Focus",
        type: "textarea",
        placeholder: "Recovery, sleep consistency, activity or readiness trends",
      },
      reviewInstructionsField,
    ],
  },
];
