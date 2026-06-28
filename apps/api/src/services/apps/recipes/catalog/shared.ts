import type { AssistantRecipe, RecipeConfigurationField } from "@assistant/schemas";

export const RECIPE_CONNECTOR_TOOL = "use_recipe_connector";
export const RECIPE_LOOKUP_TOOL = "get_recipe";
export const RECIPE_TRIGGER_TOOL = "trigger_recipe";
export const RECIPE_SETUP_TOOL = "configure_recipe";
export const WEATHER_TOOL = "get_weather";
export const WEB_SEARCH_TOOL = "web_search";
export const IMAGE_TOOL = "create_image";
export const QR_TOOL = "create_qr_code";

export type CatalogRecipeConfigurationField = Omit<RecipeConfigurationField, "required"> & {
	required?: boolean;
};

export type CatalogRecipe = Omit<AssistantRecipe, "configurationFields"> & {
	configurationFields?: CatalogRecipeConfigurationField[];
};

export const reviewInstructionsField: CatalogRecipeConfigurationField = {
	key: "instructions",
	label: "Review instructions",
	type: "textarea",
	placeholder: "Boundaries, preferred format, and what the assistant should confirm before acting",
};

export const locationField: CatalogRecipeConfigurationField = {
	key: "location",
	label: "Location",
	type: "text",
	required: true,
	placeholder: "City, postcode, or coordinates",
};

export const notionTargetField: CatalogRecipeConfigurationField = {
	key: "notionTarget",
	label: "Notion target",
	type: "text",
	required: true,
	placeholder: "Page, database, or workspace area",
};
