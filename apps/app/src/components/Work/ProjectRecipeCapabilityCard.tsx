import { Ellipsis, Plus, Trash2 } from "lucide-react";
import type { AssistantRecipe, ProjectCapability, RecipeInstallation } from "@assistant/schemas";

import { RecipeCard } from "~/components/Apps/Recipes/RecipeCard";
import { RecipeEventTriggersDialog } from "~/components/Apps/Recipes/RecipeEventTriggersDialog";
import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { Button, DropdownMenu, DropdownMenuItem } from "~/components/ui";

interface ProjectRecipeCapabilityCardProps {
	canManage: boolean;
	capability?: ProjectCapability;
	installation?: RecipeInstallation;
	isAdding: boolean;
	isRemoving: boolean;
	onAdd: () => void;
	onRemove: () => void;
	recipe: AssistantRecipe;
	workflows: ReturnType<typeof useRecipeWorkflows>;
}

export function ProjectRecipeCapabilityCard({
	canManage,
	capability,
	installation,
	isAdding,
	isRemoving,
	onAdd,
	onRemove,
	recipe,
	workflows,
}: ProjectRecipeCapabilityCardProps) {
	const cardState = workflows.actions.getRecipeCardState(recipe, installation);

	return (
		<>
			<RecipeCard
				recipe={recipe}
				installation={installation}
				onStart={workflows.actions.start}
				onConfigure={workflows.actions.configureProvider}
				onEditConfiguration={workflows.actions.openConfigurationDialog}
				onSchedule={workflows.actions.openScheduleDialog}
				onManageEventTriggers={
					cardState.canManageEventTriggers ? workflows.actions.openEventTriggersDialog : undefined
				}
				onToggleInstallationStatus={workflows.actions.toggleInstallationStatus}
				onDeleteInstallation={workflows.deleteDialog.setInstallation}
				isStarting={cardState.isStarting}
				isConfiguring={cardState.isConfiguring}
				isEditingConfiguration={cardState.isEditingConfiguration}
				isScheduling={cardState.isScheduling}
				isUpdatingInstallation={cardState.isUpdatingInstallation}
				headerAccessory={
					capability && canManage ? (
						<DropdownMenu
							position="bottom"
							buttonProps={{
								"aria-label": "Recipe project actions",
								disabled: isRemoving,
								isLoading: isRemoving,
								size: "sm",
								variant: "outline",
							}}
							trigger={<Ellipsis className="h-4 w-4" />}
						>
							<DropdownMenuItem
								className="text-red-700 dark:text-red-300"
								icon={<Trash2 className="h-4 w-4" />}
								onClick={onRemove}
							>
								Remove from project
							</DropdownMenuItem>
						</DropdownMenu>
					) : undefined
				}
				inactiveAction={
					capability ? undefined : (
						<Button
							variant="primary"
							fullWidth
							icon={<Plus className="h-4 w-4" />}
							disabled={!canManage}
							isLoading={isAdding}
							onClick={onAdd}
						>
							Add to project
						</Button>
					)
				}
			/>
			{workflows.eventDialog.recipe?.id === recipe.id && workflows.eventDialog.installation && (
				<RecipeEventTriggersDialog
					recipe={workflows.eventDialog.recipe}
					installation={workflows.eventDialog.installation}
					providers={workflows.eventDialog.providers}
					onClose={workflows.eventDialog.close}
				/>
			)}
		</>
	);
}
