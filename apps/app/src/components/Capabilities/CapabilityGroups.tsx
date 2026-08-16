import type {
	AssistantActionItem,
	AssistantRecipe,
	CapabilityCatalogItem,
	ProjectCapabilityKind,
	ProjectExperienceDefinition,
	ProjectToolDefinition,
	RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";

import type { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import type { CapabilitySurface, EnabledCapability } from "~/lib/capability-surfaces";
import type { ProjectCapabilityKindGroup } from "~/lib/project-capability-catalog";
import { getProjectCapabilityKind } from "~/lib/project-capability-catalog";
import { parseProjectToolConfiguration } from "~/lib/project-tool-configuration";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";
import { CapabilityCard } from "./CapabilityCard";
import { RecipeCapabilityCard } from "./RecipeCapabilityCard";

interface CapabilityGroupsProps {
	canManageProject: boolean;
	requiresExplicitEnablement: boolean;
	appById: Map<string, CapabilityCatalogItem>;
	capabilities: EnabledCapability[];
	currentUserId?: string | number;
	groups: ProjectCapabilityKindGroup[];
	experiences: ProjectExperienceDefinition[];
	pendingAddCapabilityId?: string;
	pendingRemoveId?: string;
	onAdd: (item: AssistantActionItem, kind: ProjectCapabilityKind) => void;
	onConfigureTool: (tool: ProjectToolDefinition, capability?: EnabledCapability) => void;
	onRemove: (capability: EnabledCapability) => void;
	recipeById: Map<string, AssistantRecipe>;
	recipeInstallationById: Map<string, RecipeInstallation>;
	recipeWorkflows: ReturnType<typeof useRecipeWorkflows>;
	toolById: Map<string, ProjectToolDefinition>;
	surface: CapabilitySurface;
}

export function CapabilityGroups({
	appById,
	canManageProject,
	requiresExplicitEnablement,
	capabilities,
	currentUserId,
	groups,
	experiences,
	pendingAddCapabilityId,
	pendingRemoveId,
	onAdd,
	onConfigureTool,
	onRemove,
	recipeById,
	recipeInstallationById,
	recipeWorkflows,
	toolById,
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
												(existing.kind === "tool" && canManageProject)
											: itemKind !== "tool" || canManageProject;
										if (recipe) {
											return (
												<RecipeCapabilityCard
													key={item.id}
													requiresExplicitEnablement={requiresExplicitEnablement}
													canManage={canManageCapability}
													capability={existing}
													installation={recipeInstallationById.get(recipe.id)}
													isAdding={isAdding}
													isRemoving={isRemoving}
													onAdd={() => onAdd(item, itemKind)}
													onRemove={() => existing && onRemove(existing)}
													recipe={recipe}
													workflows={recipeWorkflows}
												/>
											);
										}
										const tool = itemKind === "tool" ? toolById.get(item.capability.id) : undefined;
										return (
											<CapabilityCard
												key={item.id}
												canManage={canManageCapability}
												existing={existing}
												isAdding={isAdding}
												isConfigured={Boolean(
													tool &&
													parseProjectToolConfiguration(tool, existing?.configuration ?? {}),
												)}
												isRemoving={isRemoving}
												item={item}
												kind={itemKind}
												app={appById.get(item.capability.id)}
												experiences={experiences}
												onAdd={() => onAdd(item, itemKind)}
												onConfigure={
													tool?.requiresConfiguration
														? () => onConfigureTool(tool, existing)
														: undefined
												}
												onRemove={() => existing && onRemove(existing)}
												tool={tool}
												surface={surface}
												requiresExplicitEnablement={requiresExplicitEnablement}
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
