import { Plus, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import {
	CardGridLoadingSkeleton,
	ConfirmationDialog,
	EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import {
	CapabilityFilters,
	RecipeConfigurationDialog,
	RecipeScheduleDialog,
	ToolConfigurationDialog,
} from "@ngriffin_uk/polychat-component-capabilities";
import { isAuthenticationError } from "~/lib/errors";
import { CapabilityGroups } from "~/components/Capabilities/CapabilityGroups";
import { ConnectorSetupDialogs } from "~/components/Connectors/ConnectorSetupDialogs";
import {
	useCapabilityLibraryController,
	type CapabilityLibraryScope,
} from "~/components/Capabilities/useCapabilityLibraryController";
import { AddSkillDialog } from "~/components/Capabilities/AddSkillDialog";

export function CapabilityLibrary({ scope, title, subtitle }: CapabilityLibraryProps) {
	const [addSkillOpen, setAddSkillOpen] = useState(false);
	const [skillToDelete, setSkillToDelete] = useState<{ id: string; label: string } | null>(null);
	const controller = useCapabilityLibraryController(scope);
	const isLoading = controller.isLoadingScope || controller.catalog.isLoading;
	const recipeWorkflows = controller.recipes.workflows;
	const mutationError =
		controller.configurationMutation.error ??
		controller.projectMutations?.add.error ??
		controller.projectMutations?.remove.error ??
		controller.skillDeletion.error ??
		controller.personalSkills?.error;
	const pendingAddCapabilityId = controller.projectMutations?.add.isPending
		? controller.projectMutations.add.variables?.capabilityId
		: undefined;
	const pendingRemoveId = controller.projectMutations?.remove.isPending
		? controller.projectMutations.remove.variables?.capabilityId
		: undefined;
	const hasAuthenticationError =
		isAuthenticationError(controller.scopeError) ||
		isAuthenticationError(controller.catalog.error) ||
		isAuthenticationError(mutationError);
	const canManageAuthoredSkills = controller.surface.projectId
		? controller.projectActions?.canManage === true
		: Boolean(controller.currentUserId);
	const headerActions = useMemo(
		() =>
			canManageAuthoredSkills
				? [
						{
							label: "Add skill",
							icon: <Plus className="h-4 w-4" />,
							onClick: () => setAddSkillOpen(true),
						},
					]
				: undefined,
		[canManageAuthoredSkills],
	);

	return (
		<>
			<PageShell.Content className="max-w-6xl">
				<PageShell.Header title={title} actions={headerActions} />
				<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
				<CapabilityFilters
					categories={controller.filters.categories}
					category={controller.filters.category}
					filters={controller.filters.selected}
					onCategoryChange={controller.filters.setCategory}
					onFiltersChange={controller.filters.setSelected}
					onQueryChange={controller.filters.setQuery}
					query={controller.filters.query}
				/>
				{mutationError && !isAuthenticationError(mutationError) && (
					<p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-400">
						{mutationError.message}
					</p>
				)}

				{hasAuthenticationError ? (
					<SignInEmptyState
						title="Sign in to manage capabilities"
						message="Sign in to choose which experiences, recipes, skills, and tools you can use."
						className="min-h-[300px]"
					/>
				) : isLoading ? (
					<CardGridLoadingSkeleton count={6} label="Loading capabilities" />
				) : controller.scopeError || controller.catalog.error ? (
					<EmptyState
						title="Capabilities unavailable"
						message={(controller.scopeError ?? controller.catalog.error)?.message ?? "Try again."}
					/>
				) : controller.catalog.groups.length === 0 ? (
					<EmptyState
						icon={<SearchX size={24} className="text-zinc-400" />}
						title="No matching capabilities"
						message="Try another search, type, or category."
						className="min-h-[240px]"
					/>
				) : (
					<CapabilityGroups
						appById={controller.catalog.appById}
						capabilities={controller.capabilities}
						currentUserId={controller.currentUserId}
						experiences={controller.catalog.experiences}
						groups={controller.catalog.groups}
						pendingAddCapabilityId={pendingAddCapabilityId}
						pendingRemoveId={pendingRemoveId}
						onConfigureTool={controller.toolConfigurationDialog.open}
						personalSkills={controller.personalSkills}
						projectActions={controller.projectActions}
						recipeById={controller.catalog.recipeById}
						recipeInstallationById={controller.recipes.installationByRecipeId}
						recipeWorkflows={recipeWorkflows}
						toolById={controller.catalog.toolById}
						toolConfigurationById={controller.toolConfigurationById}
						surface={controller.surface}
						authoredSkillActions={{
							canDelete: canManageAuthoredSkills,
							onDelete: (id, label) => {
								controller.skillDeletion.reset();
								setSkillToDelete({ id, label });
							},
							pendingSkillId: controller.skillDeletion.pendingSkillId,
						}}
					/>
				)}
			</PageShell.Content>

			<RecipeConfigurationDialog
				recipe={recipeWorkflows.configurationDialog.recipe}
				installation={recipeWorkflows.configurationDialog.installation}
				values={recipeWorkflows.configurationDialog.values}
				onValuesChange={recipeWorkflows.configurationDialog.setValues}
				onClose={recipeWorkflows.configurationDialog.close}
				onSubmit={recipeWorkflows.configurationDialog.submit}
				isLoading={recipeWorkflows.configurationDialog.isLoading}
			/>
			<RecipeScheduleDialog
				recipe={recipeWorkflows.scheduleDialog.recipe}
				hasExistingSchedule={recipeWorkflows.scheduleDialog.hasExistingSchedule}
				cronExpression={recipeWorkflows.scheduleDialog.cronExpression}
				prompt={recipeWorkflows.scheduleDialog.prompt}
				notifySms={recipeWorkflows.scheduleDialog.notifySms}
				smsTarget={recipeWorkflows.scheduleDialog.smsTarget}
				onCronExpressionChange={recipeWorkflows.scheduleDialog.setCronExpression}
				onPromptChange={recipeWorkflows.scheduleDialog.setPrompt}
				onNotifySmsChange={recipeWorkflows.scheduleDialog.setNotifySms}
				onSmsTargetChange={recipeWorkflows.scheduleDialog.setSmsTarget}
				onClose={recipeWorkflows.scheduleDialog.close}
				onSubmit={recipeWorkflows.scheduleDialog.submit}
				isLoading={recipeWorkflows.scheduleDialog.isLoading}
			/>
			<ConfirmationDialog
				open={recipeWorkflows.deleteDialog.installation !== null}
				onOpenChange={(open) => !open && recipeWorkflows.deleteDialog.setInstallation(null)}
				title="Remove recipe"
				description="This removes your installed recipe and stops its configured schedules. The recipe itself stays available."
				confirmText="Remove"
				variant="destructive"
				isLoading={recipeWorkflows.deleteDialog.isLoading}
				onConfirm={recipeWorkflows.deleteDialog.submit}
			/>
			<ToolConfigurationDialog
				configuration={controller.toolConfigurationDialog.configuration}
				isLoading={controller.toolConfigurationDialog.isLoading}
				onClose={controller.toolConfigurationDialog.close}
				onSubmit={controller.toolConfigurationDialog.submit}
				tool={controller.toolConfigurationDialog.tool}
			/>
			<AddSkillDialog
				open={addSkillOpen}
				onOpenChange={setAddSkillOpen}
				projectId={controller.surface.projectId}
			/>
			<ConfirmationDialog
				open={skillToDelete !== null}
				onOpenChange={(open) => {
					if (!open && !controller.skillDeletion.isPending) {
						controller.skillDeletion.reset();
						setSkillToDelete(null);
					}
				}}
				title="Delete skill"
				description={`Delete ${skillToDelete?.label ?? "this skill"}? This cannot be undone.`}
				confirmText="Delete"
				variant="destructive"
				isLoading={controller.skillDeletion.isPending}
				onConfirm={async () => {
					if (!skillToDelete) return;
					await controller.skillDeletion.delete(skillToDelete.id);
					setSkillToDelete(null);
				}}
			>
				{controller.skillDeletion.error && (
					<p role="alert" className="text-sm text-red-700 dark:text-red-400">
						{controller.skillDeletion.error.message}
					</p>
				)}
			</ConfirmationDialog>
			<ConnectorSetupDialogs controller={recipeWorkflows.connectorSetup} />
		</>
	);
}

interface CapabilityLibraryProps {
	scope: CapabilityLibraryScope;
	title: string;
	subtitle: string;
}
