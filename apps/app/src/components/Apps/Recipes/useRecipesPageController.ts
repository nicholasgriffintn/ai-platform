import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
	recipeConnectorProviderSchema,
	type AssistantRecipe,
	type RecipeInstallation,
	type RecipeInstallationTrigger,
} from "@assistant/schemas";

import {
	ASSISTANT_RECIPES_QUERY_KEY,
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

export function useRecipesPageController() {
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
	const installedRecipeIds = useMemo(
		() => new Set(installationByRecipeId.keys()),
		[installationByRecipeId],
	);
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

	const closeConfigurationDialog = () => {
		setConfigurationRecipe(null);
		setConfigurationInstallation(null);
		setConfigurationValues({});
	};

	const closeScheduleDialog = () => {
		setScheduleRecipe(null);
		setScheduleInstallation(null);
		setScheduleNotifySms(false);
		setScheduleSmsTarget("");
	};

	const clearFilters = () => {
		setSearch("");
		setKind("all");
		setCategory("All");
	};

	const getRecipeCardState = (recipe: AssistantRecipe) => {
		const installation = installationByRecipeId.get(recipe.id);

		return {
			installation,
			isStarting:
				(installRecipe.isPending &&
					installRecipe.variables?.recipeId === recipe.id &&
					!installRecipe.variables?.triggers) ||
				(invokeRecipe.isPending && invokeRecipe.variables?.recipeId === recipe.id),
			isConfiguring: startConnector.isPending,
			isEditingConfiguration:
				(installRecipe.isPending &&
					installRecipe.variables?.recipeId === recipe.id &&
					Boolean(installRecipe.variables?.configuration)) ||
				(updateInstallation.isPending &&
					updateInstallation.variables?.installationId === installation?.id &&
					Boolean(updateInstallation.variables?.update.configuration)),
			isScheduling:
				(installRecipe.isPending &&
					installRecipe.variables?.recipeId === recipe.id &&
					Boolean(installRecipe.variables?.triggers)) ||
				(updateInstallation.isPending &&
					updateInstallation.variables?.installationId === installation?.id),
			isUpdatingInstallation:
				updateInstallation.isPending &&
				updateInstallation.variables?.installationId === installation?.id,
		};
	};

	return {
		filters: {
			kind,
			category,
			search,
			categories,
			setKind,
			setCategory,
			setSearch,
			clearFilters,
		},
		recipes: {
			all: recipes,
			filtered: filteredRecipes,
			isLoading,
			error,
			refetch,
			isRefetching,
			automationCount,
			configuredCount: installedRecipeIds.size,
		},
		configurationDialog: {
			recipe: configurationRecipe,
			installation: configurationInstallation,
			values: configurationValues,
			setValues: setConfigurationValues,
			close: closeConfigurationDialog,
			submit: handleSaveConfiguration,
			isLoading: installRecipe.isPending || updateInstallation.isPending,
		},
		scheduleDialog: {
			recipe: scheduleRecipe,
			hasExistingSchedule: Boolean(scheduleInstallation),
			cronExpression: scheduleCronExpression,
			prompt: schedulePrompt,
			notifySms: scheduleNotifySms,
			smsTarget: scheduleSmsTarget,
			setCronExpression: setScheduleCronExpression,
			setPrompt: setSchedulePrompt,
			setNotifySms: setScheduleNotifySms,
			setSmsTarget: setScheduleSmsTarget,
			close: closeScheduleDialog,
			submit: handleScheduleRecipe,
			isLoading: installRecipe.isPending || updateInstallation.isPending,
		},
		deleteDialog: {
			installation: installationToDelete,
			setInstallation: setInstallationToDelete,
			submit: handleDeleteInstallation,
			isLoading: deleteInstallation.isPending,
		},
		actions: {
			start: handleStart,
			configureProvider: handleConfigureProvider,
			openConfigurationDialog,
			openScheduleDialog,
			toggleInstallationStatus: handleToggleInstallationStatus,
			getRecipeCardState,
		},
	};
}
