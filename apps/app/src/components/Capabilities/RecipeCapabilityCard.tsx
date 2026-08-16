import { Ellipsis, Plus, Trash2 } from "lucide-react";
import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";

import type { EnabledCapability } from "~/lib/capability-surfaces";

import { RecipeCard } from "~/components/Apps/Recipes/RecipeCard";
import { RecipeEventTriggersDialog } from "~/components/Apps/Recipes/RecipeEventTriggersDialog";
import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import { Button, DropdownMenu, DropdownMenuItem } from "@ngriffin_uk/polychat-component-ui";

interface RecipeCapabilityCardProps {
	capability?: EnabledCapability;
	installation?: RecipeInstallation;
	projectActions?: {
		canManage: boolean;
		isAdding: boolean;
		isRemoving: boolean;
		onAdd: () => void;
		onRemove: () => void;
	};
	recipe: AssistantRecipe;
	workflows: ReturnType<typeof useRecipeWorkflows>;
}

export function RecipeCapabilityCard({
	capability,
	installation,
	projectActions,
	recipe,
	workflows,
}: RecipeCapabilityCardProps) {
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
					capability && projectActions?.canManage ? (
						<DropdownMenu
							position="bottom"
							buttonProps={{
								"aria-label": "Recipe project actions",
								disabled: projectActions.isRemoving,
								isLoading: projectActions.isRemoving,
								size: "sm",
								variant: "outline",
							}}
							trigger={<Ellipsis className="h-4 w-4" />}
						>
							<DropdownMenuItem
								className="text-red-700 dark:text-red-300"
								icon={<Trash2 className="h-4 w-4" />}
								onClick={projectActions.onRemove}
							>
								Remove from project
							</DropdownMenuItem>
						</DropdownMenu>
					) : undefined
				}
				inactiveAction={
					projectActions && !capability ? (
						<Button
							variant="primary"
							fullWidth
							icon={<Plus className="h-4 w-4" />}
							disabled={!projectActions.canManage}
							isLoading={projectActions.isAdding}
							onClick={projectActions.onAdd}
						>
							Add to project
						</Button>
					) : undefined
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
