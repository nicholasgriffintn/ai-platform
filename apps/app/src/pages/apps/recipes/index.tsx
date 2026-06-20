import { RefreshCw, SearchX } from "lucide-react";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import {
	RecipeCard,
	RecipeCatalogFilters,
	RecipeConfigurationDialog,
	RecipeScheduleDialog,
	RecipeStats,
} from "~/components/Apps/Recipes";
import { useRecipesPageController } from "~/components/Apps/Recipes/useRecipesPageController";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button, ConfirmationDialog } from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";

export function meta() {
	return [
		{ title: "Recipes - Polychat" },
		{
			name: "description",
			content: "Assistant recipes for Polychat automations and integrations.",
		},
	];
}

export default function RecipesPage() {
	const controller = useRecipesPageController();

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<div className="flex items-start justify-between gap-4">
					<PageHeader>
						<BackLink to="/apps" label="Back to Apps" />
						<PageTitle title="Recipes" />
						<p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
							Start connector-backed automations through a guided conversation. Recipe setup checks
							provider credentials before the assistant touches external systems.
						</p>
					</PageHeader>
					<Button
						variant="secondary"
						icon={<RefreshCw className="h-4 w-4" />}
						onClick={() => controller.recipes.refetch()}
						isLoading={controller.recipes.isRefetching}
					>
						Refresh
					</Button>
				</div>
			}
		>
			<RecipeStats
				availableCount={controller.recipes.all.length}
				automationCount={controller.recipes.automationCount}
				configuredCount={controller.recipes.configuredCount}
			/>

			<RecipeCatalogFilters
				search={controller.filters.search}
				kind={controller.filters.kind}
				category={controller.filters.category}
				categories={controller.filters.categories}
				onSearchChange={controller.filters.setSearch}
				onKindChange={controller.filters.setKind}
				onCategoryChange={controller.filters.setCategory}
			/>

			{controller.recipes.error ? (
				<div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
					<h3 className="mb-2 font-semibold">Failed to load recipes</h3>
					<p>
						{controller.recipes.error instanceof Error
							? controller.recipes.error.message
							: "Unknown error occurred"}
					</p>
				</div>
			) : controller.recipes.isLoading ? (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
					<CardSkeleton count={6} showHeader contentLines={4} showFooter />
				</div>
			) : controller.recipes.filtered.length === 0 ? (
				<EmptyState
					icon={<SearchX className="h-6 w-6 text-zinc-400" />}
					title="No recipes found"
					message="Adjust the search, recipe type, or category filters."
					action={
						<Button variant="secondary" onClick={controller.filters.clearFilters}>
							Clear filters
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
					{controller.recipes.filtered.map((recipe) => {
						const cardState = controller.actions.getRecipeCardState(recipe);

						return (
							<RecipeCard
								key={recipe.id}
								recipe={recipe}
								installation={cardState.installation}
								onStart={controller.actions.start}
								onConfigure={controller.actions.configureProvider}
								onEditConfiguration={controller.actions.openConfigurationDialog}
								onSchedule={controller.actions.openScheduleDialog}
								onToggleInstallationStatus={controller.actions.toggleInstallationStatus}
								onDeleteInstallation={controller.deleteDialog.setInstallation}
								isStarting={cardState.isStarting}
								isConfiguring={cardState.isConfiguring}
								isEditingConfiguration={cardState.isEditingConfiguration}
								isScheduling={cardState.isScheduling}
								isUpdatingInstallation={cardState.isUpdatingInstallation}
							/>
						);
					})}
				</div>
			)}

			<RecipeConfigurationDialog
				recipe={controller.configurationDialog.recipe}
				installation={controller.configurationDialog.installation}
				values={controller.configurationDialog.values}
				onValuesChange={controller.configurationDialog.setValues}
				onClose={controller.configurationDialog.close}
				onSubmit={controller.configurationDialog.submit}
				isLoading={controller.configurationDialog.isLoading}
			/>
			<RecipeScheduleDialog
				recipe={controller.scheduleDialog.recipe}
				hasExistingSchedule={controller.scheduleDialog.hasExistingSchedule}
				cronExpression={controller.scheduleDialog.cronExpression}
				prompt={controller.scheduleDialog.prompt}
				notifySms={controller.scheduleDialog.notifySms}
				smsTarget={controller.scheduleDialog.smsTarget}
				onCronExpressionChange={controller.scheduleDialog.setCronExpression}
				onPromptChange={controller.scheduleDialog.setPrompt}
				onNotifySmsChange={controller.scheduleDialog.setNotifySms}
				onSmsTargetChange={controller.scheduleDialog.setSmsTarget}
				onClose={controller.scheduleDialog.close}
				onSubmit={controller.scheduleDialog.submit}
				isLoading={controller.scheduleDialog.isLoading}
			/>
			<ConfirmationDialog
				open={controller.deleteDialog.installation !== null}
				onOpenChange={(open) => !open && controller.deleteDialog.setInstallation(null)}
				title="Remove recipe"
				description="This removes the installed recipe and stops any configured schedules for it."
				confirmText="Remove"
				variant="destructive"
				isLoading={controller.deleteDialog.isLoading}
				onConfirm={controller.deleteDialog.submit}
			/>
		</PageShell>
	);
}
