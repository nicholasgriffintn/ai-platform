import type {
	AssistantActionItem,
	AssistantRecipe,
	CapabilityCatalogItem,
	ProjectCapabilityKind,
	ProjectExperienceDefinition,
	ModelToolDefinition,
	RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";

import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import type { CapabilitySurface, EnabledCapability } from "~/lib/capability-surfaces";
import type { PersonalSkillControls } from "./useCapabilityLibraryController";
import type { ProjectCapabilityKindGroup } from "~/lib/project-capability-catalog";
import { getProjectCapabilityKind } from "~/lib/project-capability-catalog";
import { parseModelToolConfiguration } from "~/lib/model-tool-configuration";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";
import { CapabilityCard } from "./CapabilityCard";
import { RecipeCapabilityCard } from "./RecipeCapabilityCard";

interface CapabilityGroupsProps {
	appById: Map<string, CapabilityCatalogItem>;
	capabilities: EnabledCapability[];
	currentUserId?: string | number;
	groups: ProjectCapabilityKindGroup[];
	experiences: ProjectExperienceDefinition[];
	pendingAddCapabilityId?: string;
	pendingRemoveId?: string;
	onConfigureTool: (tool: ModelToolDefinition, configuration?: Record<string, unknown>) => void;
	projectActions?: {
		canManage: boolean;
		addItem: (item: AssistantActionItem, kind: ProjectCapabilityKind) => void;
		removeCapability: (capability: EnabledCapability & { id: string }) => void;
	};
	personalSkills?: PersonalSkillControls;
	recipeById: Map<string, AssistantRecipe>;
	recipeInstallationById: Map<string, RecipeInstallation>;
	recipeWorkflows: ReturnType<typeof useRecipeWorkflows>;
	toolById: Map<string, ModelToolDefinition>;
	toolConfigurationById: Map<string, Record<string, unknown>>;
	surface: CapabilitySurface;
}

export function CapabilityGroups({
	appById,
	capabilities,
	currentUserId,
	groups,
	experiences,
	pendingAddCapabilityId,
	pendingRemoveId,
	onConfigureTool,
	personalSkills,
	projectActions,
	recipeById,
	recipeInstallationById,
	recipeWorkflows,
	toolById,
	toolConfigurationById,
	surface,
}: CapabilityGroupsProps) {
	return (
		<div className="space-y-10">
			{groups.map((group) => (
				<section key={group.kind} aria-labelledby={`capability-kind-${group.kind}`}>
					<div className="mb-4 flex items-center gap-2">
						<h2
							id={`capability-kind-${group.kind}`}
							className="text-lg font-semibold text-zinc-950 dark:text-zinc-100"
						>
							{group.label}
						</h2>
						<span className="text-xs text-zinc-500">
							{group.categories.reduce((total, item) => total + item.items.length, 0)}
						</span>
					</div>
					<div className="space-y-7">
						{group.categories.map((categoryGroup) => (
							<div key={categoryGroup.category}>
								<h3 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
									{categoryGroup.category}
								</h3>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									{categoryGroup.items.map((item) => {
										const itemKind = getProjectCapabilityKind(item);
										if (!itemKind) return null;
										const existing = capabilities.find(
											(capability) =>
												capability.kind === itemKind &&
												capability.capabilityId === item.capability.id,
										);
										const isAdding = pendingAddCapabilityId === item.capability.id;
										const isRemoving = Boolean(existing) && pendingRemoveId === existing?.id;
										const recipe =
											itemKind === "recipe" ? recipeById.get(item.capability.id) : undefined;
										const canManageCapability = existing
											? existing.createdBy === undefined ||
												areUserIdsEqual(existing.createdBy, currentUserId) ||
												(existing.kind === "tool" && Boolean(projectActions?.canManage))
											: projectActions
												? itemKind !== "tool" || projectActions.canManage
												: true;
										if (recipe) {
											return (
												<RecipeCapabilityCard
													key={item.id}
													capability={existing}
													installation={recipeInstallationById.get(recipe.id)}
													projectActions={
														projectActions
															? {
																	canManage: canManageCapability,
																	isAdding,
																	isRemoving,
																	onAdd: () => projectActions.addItem(item, itemKind),
																	onRemove: () => {
																		if (existing) projectActions.removeCapability(existing);
																	},
																}
															: undefined
													}
													recipe={recipe}
													workflows={recipeWorkflows}
												/>
											);
										}
										const tool = itemKind === "tool" ? toolById.get(item.capability.id) : undefined;
										const skillState =
											itemKind === "skill" && personalSkills
												? personalSkills.byId.get(item.capability.id)
												: undefined;
										const toolConfiguration =
											existing?.configuration ??
											toolConfigurationById.get(item.capability.id) ??
											{};
										return (
											<CapabilityCard
												key={item.id}
												existing={existing}
												isConfigured={Boolean(
													tool && parseModelToolConfiguration(tool, toolConfiguration),
												)}
												item={item}
												kind={itemKind}
												app={appById.get(item.capability.id)}
												experiences={experiences}
												onConfigure={
													tool?.requiresConfiguration
														? () => onConfigureTool(tool, toolConfiguration)
														: undefined
												}
												projectActions={
													projectActions
														? {
																canManage: canManageCapability,
																isAdding,
																isRemoving,
																onAdd: () => projectActions.addItem(item, itemKind),
																onRemove: () => {
																	if (existing) projectActions.removeCapability(existing);
																},
															}
														: undefined
												}
												tool={tool}
												skill={
													skillState && {
														alwaysOn: skillState.alwaysOn,
														enabled: skillState.state === "ready",
														isPending: personalSkills?.pendingSkillId === skillState.id,
														onToggle: (enabled) =>
															personalSkills?.setEnabled(skillState.id, enabled),
													}
												}
												surface={surface}
											/>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
