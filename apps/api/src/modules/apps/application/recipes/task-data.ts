import {
  recipeExecutionTaskDataSchema,
  type RecipeExecutionTaskData,
} from "@ngriffin_uk/polychat-schemas";

export function createRecipeExecutionTaskData(
  input: RecipeExecutionTaskData,
): RecipeExecutionTaskData {
  return recipeExecutionTaskDataSchema.parse(input);
}
