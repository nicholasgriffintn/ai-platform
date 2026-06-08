import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";
import {
	recipeConnectorProviderSchema,
	type AssistantRecipe,
	type RecipeInstallation,
	type RecipeInstallationTrigger,
} from "@assistant/schemas";

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
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button, ConfirmationDialog } from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import {
	ASSISTANT_RECIPES_QUERY_KEY,
	RECIPE_INSTALLATIONS_QUERY_KEY,
	useAssistantRecipes,
	useDeleteRecipeInstallation,
	useInstallAssistantRecipe,
	useInvokeAssistantRecipe,
	useRecipeInstallations,
	useUpdateRecipeInstallation,
} from "~/hooks/useRecipes";
import { RECIPE_CONNECTORS_QUERY_KEY, useStartRecipeConnector } from "~/hooks/useConnectors";
import {
	buildRecipeConfigurationFromFields,
	type ConfigurationFormValues,
	formatRecipeConfigurationValue,
	getMissingRequiredRecipeConfigurationFields,
	getRecipeScheduleTrigger,
	isRecipeScheduleCronSupported,
	type RecipeKindFilter,
} from "~/lib/recipes";

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
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [kind, setKind] = useState<RecipeKindFilter>("all");
	const [category, setCategory] = useState("All");
	const [search, setSearch] = useState("");
	const [scheduleRecipe, setScheduleRecipe] = useState<AssistantRecipe | null>(null);
	const [scheduleInstallation, setScheduleInstallation] = useState<RecipeInstallation | null>(null);
	const [scheduleCronExpression, setScheduleCronExpression] = useState("0 9 * * *");
	const [schedulePrompt, setSchedulePrompt] = useState("");
	const [scheduleNotifySms, setScheduleNotifySms] = useState(false);
	const [scheduleSmsTarget, setScheduleSmsTarget] = useState("");
	const [installationToDelete, setInstallationToDelete] = useState<RecipeInstallation | null>(null);
	const [configurationRecipe, setConfigurationRecipe] = useState<AssistantRecipe | null>(null);
	const [configurationInstallation, setConfigurationInstallation] =
		useState<RecipeInstallation | null>(null);
	const [configurationValues, setConfigurationValues] = useState<ConfigurationFormValues>({});
	const { data, isLoading, error, refetch, isRefetching } = useAssistantRecipes();
	const { data: installationsData } = useRecipeInstallations();
	const installRecipe = useInstallAssistantRecipe();
	const invokeRecipe = useInvokeAssistantRecipe();
	const updateInstallation = useUpdateRecipeInstallation();
	const deleteInstallation = useDeleteRecipeInstallation();
	const startConnector = useStartRecipeConnector();

	const recipes = data?.recipes ?? [];
	const categories = ["All", ...(data?.categories ?? [])];
	const filteredRecipes = useMemo(
		() =>
			recipes.filter((recipe) => {
				const matchesKind = kind === "all" || recipe.kind === kind;
				const matchesCategory = category === "All" || recipe.category === category;
				const query = search.trim().toLowerCase();
				const matchesSearch =
					!query ||
					[
						recipe.title,
						recipe.summary,
						recipe.description,
						recipe.category,
						...recipe.actions,
						...recipe.integrations.map((integration) => integration.name),
					]
						.join(" ")
						.toLowerCase()
						.includes(query);

				return matchesKind && matchesCategory && matchesSearch;
			}),
		[category, kind, recipes, search],
	);

	const automationCount = recipes.filter((recipe) => recipe.kind === "automate").length;
	const installationByRecipeId = useMemo(
		() =>
			new Map(
				(installationsData?.installations ?? []).map((installation) => [
					installation.recipeId,
					installation,
				]),
			),
		[installationsData?.installations],
	);
	const installedRecipeIds = new Set(installationByRecipeId.keys());
	const scheduleCronIsSupported = isRecipeScheduleCronSupported(scheduleCronExpression);

	const handleStart = async (recipe: AssistantRecipe, installation?: RecipeInstallation) => {
		try {
			const setup = installation
				? await invokeRecipe.mutateAsync({ recipeId: recipe.id })
				: await installRecipe.mutateAsync({ recipeId: recipe.id });
			navigate(setup.messageUrl);
		} catch (startError) {
			console.error(startError);
			toast.error("Could not start recipe chat. Please try again.");
		}
	};

	const handleScheduleRecipe = async () => {
		if (!scheduleRecipe) {
			return;
		}
		if (!scheduleCronIsSupported) {
			toast.error("Use a supported five-field cron expression.");
			return;
		}

		const triggers: RecipeInstallationTrigger[] = [
			{ type: "manual", enabled: true },
			{
				type: "schedule",
				enabled: true,
				cronExpression: scheduleCronExpression,
				prompt: schedulePrompt.trim() || undefined,
				notificationChannel: scheduleNotifySms ? "sms" : undefined,
				notificationTarget: scheduleNotifySms ? scheduleSmsTarget.trim() : undefined,
			},
		];

		try {
			if (scheduleInstallation) {
				await updateInstallation.mutateAsync({
					installationId: scheduleInstallation.id,
					update: { status: "active", triggers },
				});
			} else {
				await installRecipe.mutateAsync({
					recipeId: scheduleRecipe.id,
					triggers,
				});
			}
			await queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			await queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
			setScheduleRecipe(null);
			setScheduleInstallation(null);
			setScheduleNotifySms(false);
			setScheduleSmsTarget("");
			toast.success("Recipe scheduled.");
		} catch (scheduleError) {
			console.error(scheduleError);
			toast.error("Could not schedule recipe.");
		}
	};

	const openConfigurationDialog = (
		nextRecipe: AssistantRecipe,
		installation?: RecipeInstallation,
	) => {
		const configuration = installation?.configuration ?? {};
		const values = Object.fromEntries(
			nextRecipe.configurationFields.map((field) => [
				field.key,
				formatRecipeConfigurationValue(field, configuration),
			]),
		);
		setConfigurationRecipe(nextRecipe);
		setConfigurationInstallation(installation ?? null);
		setConfigurationValues(values);
	};

	const handleSaveConfiguration = async () => {
		if (!configurationRecipe) {
			return;
		}

		const configuration = buildRecipeConfigurationFromFields(
			configurationRecipe.configurationFields,
			configurationValues,
		);

		try {
			if (configurationInstallation) {
				await updateInstallation.mutateAsync({
					installationId: configurationInstallation.id,
					update: { configuration },
				});
			} else {
				await installRecipe.mutateAsync({
					recipeId: configurationRecipe.id,
					configuration,
				});
			}
			await queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			await queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
			setConfigurationRecipe(null);
			setConfigurationInstallation(null);
			toast.success("Recipe configuration saved.");
		} catch (configurationError) {
			console.error(configurationError);
			toast.error("Could not save recipe configuration.");
		}
	};

	const openScheduleDialog = (nextRecipe: AssistantRecipe, installation?: RecipeInstallation) => {
		const missingRequiredFields = getMissingRequiredRecipeConfigurationFields(
			nextRecipe,
			installation,
		);
		if (missingRequiredFields.length > 0) {
			openConfigurationDialog(nextRecipe, installation);
			toast.info("Save required recipe configuration before scheduling.");
			return;
		}

		const scheduleTrigger = getRecipeScheduleTrigger(installation);
		setScheduleRecipe(nextRecipe);
		setScheduleInstallation(installation ?? null);
		setScheduleCronExpression(scheduleTrigger?.cronExpression ?? "0 9 * * *");
		setSchedulePrompt(scheduleTrigger?.prompt ?? nextRecipe.setupPrompt);
		setScheduleNotifySms(scheduleTrigger?.notificationChannel === "sms");
		setScheduleSmsTarget(scheduleTrigger?.notificationTarget ?? "");
	};

	const handleToggleInstallationStatus = async (installation: RecipeInstallation) => {
		try {
			await updateInstallation.mutateAsync({
				installationId: installation.id,
				update: { status: installation.status === "paused" ? "active" : "paused" },
			});
			await queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			toast.success(installation.status === "paused" ? "Recipe resumed." : "Recipe paused.");
		} catch (updateError) {
			console.error(updateError);
			toast.error("Could not update recipe.");
		}
	};

	const handleDeleteInstallation = async () => {
		if (!installationToDelete) {
			return;
		}

		try {
			await deleteInstallation.mutateAsync({ installationId: installationToDelete.id });
			await queryClient.invalidateQueries({ queryKey: RECIPE_INSTALLATIONS_QUERY_KEY });
			setInstallationToDelete(null);
			toast.success("Recipe removed.");
		} catch (deleteError) {
			console.error(deleteError);
			toast.error("Could not remove recipe.");
		}
	};

	const handleConfigureProvider = async (providerId: string, setupUrl?: string) => {
		const parsedProvider = recipeConnectorProviderSchema.safeParse(providerId);
		if (!parsedProvider.success) {
			if (setupUrl) {
				navigate(setupUrl);
				return;
			}
			toast.error("This connector is not available yet.");
			return;
		}

		try {
			const response = await startConnector.mutateAsync({
				provider: parsedProvider.data,
				returnTo: "/apps/recipes",
			});
			queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
			window.location.href = response.authorizationUrl;
		} catch (configureError) {
			console.error(configureError);
			if (setupUrl) {
				navigate(setupUrl);
				return;
			}
			toast.error("Could not start connector setup.");
		}
	};

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
						onClick={() => refetch()}
						isLoading={isRefetching}
					>
						Refresh
					</Button>
				</div>
			}
		>
			<RecipeStats
				availableCount={recipes.length}
				automationCount={automationCount}
				configuredCount={installedRecipeIds.size}
			/>

			<RecipeCatalogFilters
				search={search}
				kind={kind}
				category={category}
				categories={categories}
				onSearchChange={setSearch}
				onKindChange={setKind}
				onCategoryChange={setCategory}
			/>

			{error ? (
				<div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
					<h3 className="mb-2 font-semibold">Failed to load recipes</h3>
					<p>{error instanceof Error ? error.message : "Unknown error occurred"}</p>
				</div>
			) : isLoading ? (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
					<CardSkeleton count={6} showHeader contentLines={4} showFooter />
				</div>
			) : filteredRecipes.length === 0 ? (
				<EmptyState
					icon={<SearchX className="h-6 w-6 text-zinc-400" />}
					title="No recipes found"
					message="Adjust the search, recipe type, or category filters."
					action={
						<Button
							variant="secondary"
							onClick={() => {
								setSearch("");
								setKind("all");
								setCategory("All");
							}}
						>
							Clear filters
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
					{filteredRecipes.map((recipe) => (
						<RecipeCard
							key={recipe.id}
							recipe={recipe}
							installation={installationByRecipeId.get(recipe.id)}
							onStart={handleStart}
							onConfigure={handleConfigureProvider}
							onEditConfiguration={openConfigurationDialog}
							onSchedule={openScheduleDialog}
							onToggleInstallationStatus={handleToggleInstallationStatus}
							onDeleteInstallation={setInstallationToDelete}
							isStarting={
								(installRecipe.isPending &&
									installRecipe.variables?.recipeId === recipe.id &&
									!installRecipe.variables?.triggers) ||
								(invokeRecipe.isPending && invokeRecipe.variables?.recipeId === recipe.id)
							}
							isConfiguring={startConnector.isPending}
							isEditingConfiguration={
								(installRecipe.isPending &&
									installRecipe.variables?.recipeId === recipe.id &&
									Boolean(installRecipe.variables?.configuration)) ||
								(updateInstallation.isPending &&
									updateInstallation.variables?.installationId ===
										installationByRecipeId.get(recipe.id)?.id &&
									Boolean(updateInstallation.variables?.update.configuration))
							}
							isScheduling={
								(installRecipe.isPending &&
									installRecipe.variables?.recipeId === recipe.id &&
									Boolean(installRecipe.variables?.triggers)) ||
								(updateInstallation.isPending &&
									updateInstallation.variables?.installationId ===
										installationByRecipeId.get(recipe.id)?.id)
							}
							isUpdatingInstallation={
								updateInstallation.isPending &&
								updateInstallation.variables?.installationId ===
									installationByRecipeId.get(recipe.id)?.id
							}
						/>
					))}
				</div>
			)}

			<RecipeConfigurationDialog
				recipe={configurationRecipe}
				installation={configurationInstallation}
				values={configurationValues}
				onValuesChange={setConfigurationValues}
				onClose={() => {
					setConfigurationRecipe(null);
					setConfigurationInstallation(null);
					setConfigurationValues({});
				}}
				onSubmit={handleSaveConfiguration}
				isLoading={installRecipe.isPending || updateInstallation.isPending}
			/>
			<RecipeScheduleDialog
				recipe={scheduleRecipe}
				hasExistingSchedule={Boolean(scheduleInstallation)}
				cronExpression={scheduleCronExpression}
				prompt={schedulePrompt}
				notifySms={scheduleNotifySms}
				smsTarget={scheduleSmsTarget}
				onCronExpressionChange={setScheduleCronExpression}
				onPromptChange={setSchedulePrompt}
				onNotifySmsChange={setScheduleNotifySms}
				onSmsTargetChange={setScheduleSmsTarget}
				onClose={() => {
					setScheduleRecipe(null);
					setScheduleInstallation(null);
					setScheduleNotifySms(false);
					setScheduleSmsTarget("");
				}}
				onSubmit={handleScheduleRecipe}
				isLoading={installRecipe.isPending || updateInstallation.isPending}
			/>
			<ConfirmationDialog
				open={installationToDelete !== null}
				onOpenChange={(open) => !open && setInstallationToDelete(null)}
				title="Remove recipe"
				description="This removes the installed recipe and stops any configured schedules for it."
				confirmText="Remove"
				variant="destructive"
				isLoading={deleteInstallation.isPending}
				onConfirm={handleDeleteInstallation}
			/>
		</PageShell>
	);
}
