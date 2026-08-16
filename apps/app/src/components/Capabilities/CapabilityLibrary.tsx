import { SearchX } from "lucide-react";

import { RecipeConfigurationDialog } from "~/components/Apps/Recipes/RecipeConfigurationDialog";
import { RecipeScheduleDialog } from "~/components/Apps/Recipes/RecipeScheduleDialog";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageShell } from "~/components/Core/PageShell";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { CapabilityFilters } from "@ngriffin_uk/polychat-component-capabilities";
import { isAuthenticationError } from "~/lib/errors";
import { CapabilityGroups } from "~/components/Capabilities/CapabilityGroups";
import { ToolConfigurationDialog } from "~/components/Capabilities/ToolConfigurationDialog";
import { CardGridLoadingSkeleton } from "~/components/Core/LoadingSkeletons";
import {
	useCapabilityLibraryController,
	type CapabilityLibraryScope,
} from "~/components/Capabilities/useCapabilityLibraryController";

export function CapabilityLibrary({ scope, title, subtitle }: CapabilityLibraryProps) {
	const controller = useCapabilityLibraryController(scope);
	const isLoading = controller.isLoadingScope || controller.catalog.isLoading;
	const recipeWorkflows = controller.recipes.workflows;
	const mutationError = controller.mutations.add.error ?? controller.mutations.remove.error;
	const pendingAddCapabilityId = controller.mutations.add.isPending
		? controller.mutations.add.variables?.capabilityId
		: undefined;
	const pendingRemoveId = controller.mutations.remove.isPending
		? controller.mutations.remove.variables?.capabilityId
		: undefined;
	const hasAuthenticationError =
		isAuthenticationError(controller.scopeError) ||
		isAuthenticationError(controller.catalog.error) ||
		isAuthenticationError(mutationError);

	return (
		<>
			<PageShell.Content className="max-w-6xl">
				<PageShell.Header title={title} />
				<p className="mb-6 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>

				<CapabilityFilters
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
						message="Sign in to choose which experiences, recipes, and tools you can use."
						className="min-h-[300px]"
					/>
				) : isLoading ? (
					<CardGridLoadingSkeleton count={6} label="Loading capabilities" />
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
					<CapabilityGroups
						appById={controller.catalog.appById}
						canManageProject={controller.canManage}
						requiresExplicitEnablement={controller.requiresExplicitEnablement}
						capabilities={controller.capabilities}
						currentUserId={controller.currentUserId}
						experiences={controller.catalog.experiences}
						groups={controller.catalog.groups}
						pendingAddCapabilityId={pendingAddCapabilityId}
						pendingRemoveId={pendingRemoveId}
						onAdd={controller.actions.addItem}
						onConfigureTool={controller.toolConfigurationDialog.open}
						onRemove={controller.actions.removeCapability}
						recipeById={controller.catalog.recipeById}
						recipeInstallationById={controller.recipes.installationByRecipeId}
						recipeWorkflows={recipeWorkflows}
						toolById={controller.catalog.toolById}
						surface={controller.surface}
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
				capability={controller.toolConfigurationDialog.capability}
				isLoading={controller.toolConfigurationDialog.isLoading}
				onClose={controller.toolConfigurationDialog.close}
				onSubmit={controller.toolConfigurationDialog.submit}
				tool={controller.toolConfigurationDialog.tool}
			/>
		</>
	);
}

interface CapabilityLibraryProps {
	scope: CapabilityLibraryScope;
	title: string;
	subtitle: string;
}
