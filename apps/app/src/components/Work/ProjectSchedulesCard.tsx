import type {
	AssistantRecipe,
	ProjectCapability,
	RecipeInstallation,
	WorkspaceMember,
} from "@ngriffin_uk/polychat-schemas";
import {
	CalendarClock,
	CalendarX2,
	Ellipsis,
	Eye,
	PauseCircle,
	PlayCircle,
	Plus,
	Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
	RecipeConfigurationDialog,
	RecipeConfigurationSummaryDialog,
	RecipeScheduleDialog,
} from "~/components/Apps/Recipes";
import { useRecipeWorkflows } from "~/components/Apps/Recipes/useRecipeWorkflows";
import {
	Button,
	Card,
	ConfirmationDialog,
	DropdownMenu,
	DropdownMenuItem,
	FormDialog,
	FormSelect,
} from "@ngriffin_uk/polychat-component-ui";
import { useAssistantRecipes, useRecipeInstallations } from "~/hooks/useRecipes";
import { getRecipeScheduleTrigger } from "~/lib/recipes";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";
import { useChatStore } from "~/state/stores/chatStore";

export function ProjectSchedulesCard({
	workspaceId,
	projectId,
	capabilities,
	members,
	embedded = false,
}: {
	workspaceId: string;
	projectId: string;
	capabilities: ProjectCapability[];
	members: WorkspaceMember[];
	embedded?: boolean;
}) {
	const currentUserId = useChatStore((state) => state.user?.id);
	const recipes = useAssistantRecipes();
	const installations = useRecipeInstallations(projectId);
	const workflows = useRecipeWorkflows({
		conversationPath: `/work/${workspaceId}/projects/${projectId}/chat`,
		projectId,
	});
	const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
	const [selectedRecipeId, setSelectedRecipeId] = useState("");
	const [configurationView, setConfigurationView] = useState<{
		recipe: AssistantRecipe;
		installation: RecipeInstallation;
	} | null>(null);
	const [scheduleToStop, setScheduleToStop] = useState<{
		recipe: AssistantRecipe;
		installation: RecipeInstallation;
	} | null>(null);
	const enabledRecipeIds = useMemo(
		() =>
			new Set(
				capabilities
					.filter((capability) => capability.kind === "recipe")
					.map((capability) => capability.capabilityId),
			),
		[capabilities],
	);
	const schedulableRecipes = (recipes.data?.recipes ?? []).filter(
		(recipe) =>
			enabledRecipeIds.has(recipe.id) &&
			recipe.triggers.some((trigger) => trigger.type === "schedule"),
	);
	const recipeById = new Map((recipes.data?.recipes ?? []).map((recipe) => [recipe.id, recipe]));
	const projectInstallations = installations.data?.installations ?? [];
	const scheduleEntries = projectInstallations.flatMap((installation) => {
		const trigger = getRecipeScheduleTrigger(installation);
		return trigger
			? [{ installation, trigger, recipe: recipeById.get(installation.recipeId) }]
			: [];
	});
	const ownInstallationByRecipeId = new Map(
		projectInstallations
			.filter((installation) => areUserIdsEqual(installation.userId, currentUserId))
			.map((installation) => [installation.recipeId, installation]),
	);
	const memberNameById = new Map(
		members.map((member) => [String(member.userId), member.name || member.email]),
	);

	const openRecipePicker = () => {
		setSelectedRecipeId(schedulableRecipes[0]?.id ?? "");
		setIsRecipePickerOpen(true);
	};

	const content = (
		<section
			className={`space-y-4 p-5 ${embedded ? "border-t border-zinc-100 dark:border-zinc-800" : ""}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
						<CalendarClock size={17} />
					</div>
					<div>
						<h2 className="text-sm font-semibold">Scheduled recipes</h2>
						<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
							Runs appear as conversations in this project.
						</p>
					</div>
				</div>
				<Button
					variant="icon"
					size="icon"
					icon={<Plus size={16} />}
					aria-label="Schedule a project recipe"
					disabled={schedulableRecipes.length === 0}
					onClick={openRecipePicker}
				/>
			</div>

			{scheduleEntries.length ? (
				<ul className="space-y-2">
					{scheduleEntries.map(({ installation, recipe, trigger }) => {
						const canManage = areUserIdsEqual(installation.userId, currentUserId);
						const isPaused = !trigger.enabled || installation.status === "paused";
						const isUpdating = recipe
							? workflows.actions.getRecipeCardState(recipe, installation).isUpdatingInstallation
							: false;
						return (
							<li
								key={installation.id}
								className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">
										{recipe?.title ?? installation.recipeId}
									</p>
									<p className="truncate text-xs text-zinc-500">
										{trigger.cronExpression} · {isPaused ? "paused" : "active"}
										{" · "}
										{memberNameById.get(String(installation.userId)) ?? "Project member"}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-1">
									{recipe ? (
										<Button
											variant="icon"
											size="icon"
											icon={<Eye size={15} />}
											aria-label={`View ${recipe.title} configuration`}
											onClick={() => setConfigurationView({ recipe, installation })}
										/>
									) : null}
									{canManage && recipe ? (
										<DropdownMenu
											position="left"
											buttonProps={{
												"aria-label": `Manage ${recipe.title} schedule`,
												disabled: isUpdating,
												size: "icon",
												variant: "icon",
											}}
											trigger={<Ellipsis size={16} />}
										>
											<DropdownMenuItem
												icon={<Settings2 size={15} />}
												onClick={() => workflows.actions.openScheduleDialog(recipe, installation)}
											>
												Edit schedule
											</DropdownMenuItem>
											<DropdownMenuItem
												icon={isPaused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
												onClick={() =>
													void workflows.actions.setScheduleEnabled(installation, isPaused)
												}
											>
												{isPaused ? "Resume schedule" : "Pause schedule"}
											</DropdownMenuItem>
											<DropdownMenuItem
												className="text-red-700 dark:text-red-300"
												icon={<CalendarX2 size={15} />}
												onClick={() => setScheduleToStop({ recipe, installation })}
											>
												Stop schedule
											</DropdownMenuItem>
										</DropdownMenu>
									) : null}
								</div>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="text-sm text-zinc-500">No recipes are scheduled for this project.</p>
			)}
		</section>
	);

	return (
		<>
			{embedded ? (
				content
			) : (
				<Card className="gap-0 overflow-hidden py-0 shadow-none">{content}</Card>
			)}

			<FormDialog
				open={isRecipePickerOpen}
				onOpenChange={setIsRecipePickerOpen}
				title="Schedule a project recipe"
				description="The run uses your connected accounts and is visible to project members."
				submitText="Continue"
				submitDisabled={!selectedRecipeId}
				onSubmit={() => {
					const recipe = schedulableRecipes.find((candidate) => candidate.id === selectedRecipeId);
					if (!recipe) return;
					setIsRecipePickerOpen(false);
					workflows.actions.openScheduleDialog(recipe, ownInstallationByRecipeId.get(recipe.id));
				}}
			>
				<FormSelect
					label="Recipe"
					value={selectedRecipeId}
					onChange={(event) => setSelectedRecipeId(event.target.value)}
					options={schedulableRecipes.map((recipe) => ({
						value: recipe.id,
						label: recipe.title,
					}))}
				/>
			</FormDialog>

			<RecipeConfigurationDialog
				recipe={workflows.configurationDialog.recipe}
				installation={workflows.configurationDialog.installation}
				values={workflows.configurationDialog.values}
				onValuesChange={workflows.configurationDialog.setValues}
				onClose={workflows.configurationDialog.close}
				onSubmit={workflows.configurationDialog.submit}
				isLoading={workflows.configurationDialog.isLoading}
			/>
			<RecipeScheduleDialog
				recipe={workflows.scheduleDialog.recipe}
				hasExistingSchedule={workflows.scheduleDialog.hasExistingSchedule}
				cronExpression={workflows.scheduleDialog.cronExpression}
				prompt={workflows.scheduleDialog.prompt}
				notifySms={workflows.scheduleDialog.notifySms}
				smsTarget={workflows.scheduleDialog.smsTarget}
				onCronExpressionChange={workflows.scheduleDialog.setCronExpression}
				onPromptChange={workflows.scheduleDialog.setPrompt}
				onNotifySmsChange={workflows.scheduleDialog.setNotifySms}
				onSmsTargetChange={workflows.scheduleDialog.setSmsTarget}
				onClose={workflows.scheduleDialog.close}
				onSubmit={workflows.scheduleDialog.submit}
				isLoading={workflows.scheduleDialog.isLoading}
			/>
			<RecipeConfigurationSummaryDialog
				recipe={configurationView?.recipe ?? null}
				installation={configurationView?.installation ?? null}
				onOpenChange={(open) => {
					if (!open) setConfigurationView(null);
				}}
			/>
			<ConfirmationDialog
				open={scheduleToStop !== null}
				onOpenChange={(open) => {
					if (!open) setScheduleToStop(null);
				}}
				title="Stop recipe schedule"
				description={`Stop the ${scheduleToStop?.recipe.title ?? "recipe"} schedule? Its saved configuration and recipe installation will be kept.`}
				confirmText="Stop schedule"
				variant="destructive"
				isLoading={
					scheduleToStop
						? workflows.actions.getRecipeCardState(
								scheduleToStop.recipe,
								scheduleToStop.installation,
							).isUpdatingInstallation
						: false
				}
				onConfirm={async () => {
					if (!scheduleToStop) return;
					await workflows.actions.stopSchedule(scheduleToStop.installation);
					setScheduleToStop(null);
				}}
			/>
		</>
	);
}
