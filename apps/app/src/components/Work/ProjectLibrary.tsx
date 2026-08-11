import { SearchX } from "lucide-react";

import { RecipeConfigurationDialog } from "~/components/Apps/Recipes/RecipeConfigurationDialog";
import { RecipeScheduleDialog } from "~/components/Apps/Recipes/RecipeScheduleDialog";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { ConfirmationDialog } from "~/components/ui";
import { isAuthenticationError } from "~/lib/errors";
import { ProjectCapabilityFilters } from "./ProjectCapabilityFilters";
import { ProjectCapabilityGroups } from "./ProjectCapabilityGroups";
import { ProjectToolConfigurationDialog } from "./ProjectToolConfigurationDialog";
import { WorkCardGridSkeleton } from "./WorkLoadingSkeletons";
import { useProjectLibraryController } from "./useProjectLibraryController";

export function ProjectLibrary({ workspaceId, projectId }: ProjectLibraryProps) {
	const controller = useProjectLibraryController(workspaceId, projectId);
	const isLoading = controller.isLoadingProject || controller.catalog.isLoading;
	const recipeWorkflows = controller.recipes.workflows;
	const mutationError = controller.mutations.add.error ?? controller.mutations.remove.error;
	const hasAuthenticationError =
		isAuthenticationError(controller.projectError) ||
		isAuthenticationError(controller.catalog.error) ||
		isAuthenticationError(mutationError);

	return (
		<>
			<main className="container mx-auto max-w-6xl px-4 py-8">
				<PageHeader>
					<PageTitle title="Capabilities" />
					<p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
						Choose which apps, recipes, and tools are available in
						{controller.project ? ` ${controller.project.name}` : " this project"}.
					</p>
				</PageHeader>

				<ProjectCapabilityFilters
					categories={controller.filters.categories}
					category={controller.filters.category}
					kind={controller.filters.kind}
					onCategoryChange={controller.filters.setCategory}
					onKindChange={controller.filters.setKind}
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
						message="Sign in to access this project's capabilities."
						className="min-h-[300px]"
					/>
				) : isLoading ? (
					<WorkCardGridSkeleton count={6} label="Loading project capabilities" />
				) : controller.catalog.error ? (
					<EmptyState title="Capabilities unavailable" message={controller.catalog.error.message} />
				) : controller.catalog.groups.length === 0 ? (
					<EmptyState
						icon={<SearchX size={24} className="text-zinc-400" />}
						title="No matching capabilities"
						message="Try another search, type, or category."
						className="min-h-[240px]"
					/>
				) : (
					<ProjectCapabilityGroups
						appById={controller.catalog.appById}
						canManage={controller.canManage}
						capabilities={controller.project?.capabilities ?? []}
						experiences={controller.catalog.experiences}
						groups={controller.catalog.groups}
						isAdding={controller.mutations.add.isPending}
						isRemoving={controller.mutations.remove.isPending}
						onAdd={controller.actions.addItem}
						onConfigureTool={controller.toolConfigurationDialog.open}
						onRemove={controller.actions.removeCapability}
						projectId={projectId}
						recipeById={controller.catalog.recipeById}
						recipeInstallationById={controller.recipes.installationByRecipeId}
						recipeWorkflows={recipeWorkflows}
						toolById={controller.catalog.toolById}
						workspaceId={workspaceId}
					/>
				)}
			</main>

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
				description="This removes your installed recipe and stops its configured schedules. The recipe remains available to the project."
				confirmText="Remove"
				variant="destructive"
				isLoading={recipeWorkflows.deleteDialog.isLoading}
				onConfirm={recipeWorkflows.deleteDialog.submit}
			/>
			<ProjectToolConfigurationDialog
				capability={controller.toolConfigurationDialog.capability}
				isLoading={controller.toolConfigurationDialog.isLoading}
				onClose={controller.toolConfigurationDialog.close}
				onSubmit={controller.toolConfigurationDialog.submit}
				tool={controller.toolConfigurationDialog.tool}
			/>
		</>
	);
}

interface ProjectLibraryProps {
	workspaceId: string;
	projectId: string;
}
