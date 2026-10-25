import { WIND_DOWN_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { CatalogRecipe } from "./shared";

export const wellbeingRecipes: CatalogRecipe[] = [
  {
    id: "evening-wind-down",
    title: "Evening Wind Down",
    summary:
      "Have a wind-down session ready each evening: a guided session, a slow story or just the sound.",
    description:
      "Each evening Poly records a calm session over a quiet sound bed and leaves it in Discover, ready to play. It makes no medical claims.",
    kind: "automate",
    category: "Health",
    featured: false,
    readOnly: true,
    resultPath: "/discover",
    enabledTools: [WIND_DOWN_TOOL_NAME],
    integrations: [],
    triggers: [
      {
        type: "schedule",
        label: "Each evening",
        description: "Prepare tonight's session at the time you choose.",
      },
    ],
    actions: [
      `Call ${WIND_DOWN_TOOL_NAME} once with the session kind and length from the configuration. When none is set, use unwind for ten minutes`,
      "Finish with one short sentence saying tonight's session is ready in Discover",
    ],
    setupPrompt:
      "Set up the Evening Wind Down recipe. Ask what time in the evening suits, which kind of session (breathing, body scan, unwind, story, read back or just the sound) and how long (five, ten, twenty or thirty minutes).",
    configurationFields: [
      {
        key: "kind",
        label: "Session",
        type: "text",
        placeholder: "breathing, body_scan, unwind, story, read_back or sound",
      },
      {
        key: "minutes",
        label: "Length in minutes",
        type: "text",
        placeholder: "5, 10, 20 or 30",
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
