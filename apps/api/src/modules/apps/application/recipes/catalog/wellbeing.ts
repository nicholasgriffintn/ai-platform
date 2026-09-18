import type { CatalogRecipe } from "./shared";

export const wellbeingRecipes: CatalogRecipe[] = [
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
