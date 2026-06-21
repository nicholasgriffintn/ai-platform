import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
	type AssistantRecipe,
	type RecipeConnectorManifest,
	type RecipeInstallation,
	type RecipeInstallationTrigger,
} from "@assistant/schemas";

import {
	RECIPE_CONNECTORS_QUERY_KEY,
	useRecipeConnectors,
	useStartRecipeConnector,
} from "~/hooks/useConnectors";
import {
	ASSISTANT_RECIPES_QUERY_KEY,
	useDeleteRecipeInstallation,
	useInstallAssistantRecipe,
	useInvokeAssistantRecipe,
	useUpdateRecipeInstallation,
} from "~/hooks/useRecipes";
import { launchAssistantAction } from "~/lib/assistant-action-flow";
import {
	createConnectorAssistantActionItem,
	createRecipeAssistantActionItem,
} from "~/lib/assistant-actions";
import {
	buildRecipeConfigurationFromFields,
	type ConfigurationFormValues,
	formatRecipeConfigurationValue,
	getMissingRequiredRecipeConfigurationFields,
	getRecipeScheduleTrigger,
	isRecipeScheduleCronSupported,
} from "~/lib/recipes";

export function useRecipeWorkflows() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
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
	const installRecipe = useInstallAssistantRecipe();
	const invokeRecipe = useInvokeAssistantRecipe();
	const updateInstallation = useUpdateRecipeInstallation();
	const deleteInstallation = useDeleteRecipeInstallation();
	const startConnector = useStartRecipeConnector();
	const { data: connectorsData } = useRecipeConnectors();
	const connectorByProviderId = useMemo<Map<string, RecipeConnectorManifest>>(
		() =>
			new Map<string, RecipeConnectorManifest>(
				(connectorsData?.connectors ?? []).map((connector) => [connector.id, connector]),
			),
		[connectorsData?.connectors],
	);
	const scheduleCronIsSupported = isRecipeScheduleCronSupported(scheduleCronExpression);

	const start = async (recipe: AssistantRecipe, installation?: RecipeInstallation) => {
		try {
			const result = await launchAssistantAction(
				{
					delivery: "conversation",
					input: "",
					item: createRecipeAssistantActionItem(recipe, installation),
					selectedTools: [],
				},
				{
					installRecipe: (recipeId) => installRecipe.mutateAsync({ recipeId }),
					invokeRecipe: (recipeId, input) =>
						invokeRecipe.mutateAsync({
							recipeId,
							...(input.trim() ? { input } : {}),
						}),
					startConnector: (provider, returnTo) =>
						startConnector.mutateAsync({ provider, returnTo }),
				},
			);

			if (result.notification?.type === "error") {
				toast.error(result.notification.message);
				return;
			}
			if (result.kind === "external") {
				window.location.href = result.url;
				return;
			}
			if (result.kind === "navigation") {
				navigate(result.path);
				return;
			}
			if (result.kind === "conversation") {
				navigate(result.url);
			}
		} catch (startError) {
			console.error(startError);
			toast.error("Could not start recipe chat. Please try again.");
		}
	};

	const submitSchedule = async () => {
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

	const submitConfiguration = async () => {
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

	const toggleInstallationStatus = async (installation: RecipeInstallation) => {
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

	const submitDeleteInstallation = async () => {
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

	const configureProvider = async (providerId: string, setupUrl?: string) => {
		const connector = connectorByProviderId.get(providerId);
		if (!connector) {
			if (setupUrl) {
				navigate(setupUrl);
				return;
			}
			toast.error("This connector is not available yet.");
			return;
		}

		try {
			const result = await launchAssistantAction(
				{
					delivery: "conversation",
					input: "",
					item: createConnectorAssistantActionItem(connector),
					connectorReturnTo: "/apps/recipes",
					selectedTools: [],
				},
				{
					installRecipe: (recipeId) => installRecipe.mutateAsync({ recipeId }),
					invokeRecipe: (recipeId, input) =>
						invokeRecipe.mutateAsync({
							recipeId,
							...(input.trim() ? { input } : {}),
						}),
					startConnector: (provider, returnTo) =>
						startConnector.mutateAsync({ provider, returnTo }),
				},
			);
			queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY });
			if (result.notification?.type === "error") {
				toast.error(result.notification.message);
				return;
			}
			if (result.kind === "external") {
				window.location.href = result.url;
				return;
			}
			if (result.kind === "navigation") {
				navigate(result.path);
			}
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

	const getRecipeCardState = (recipe: AssistantRecipe, installation?: RecipeInstallation) => ({
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
	});

	return {
		configurationDialog: {
			recipe: configurationRecipe,
			installation: configurationInstallation,
			values: configurationValues,
			setValues: setConfigurationValues,
			close: closeConfigurationDialog,
			submit: submitConfiguration,
			isLoading: installRecipe.isPending || updateInstallation.isPending,
		},
		scheduleDialog: {
			recipe: scheduleRecipe,
			hasExistingSchedule: Boolean(getRecipeScheduleTrigger(scheduleInstallation ?? undefined)),
			cronExpression: scheduleCronExpression,
			prompt: schedulePrompt,
			notifySms: scheduleNotifySms,
			smsTarget: scheduleSmsTarget,
			setCronExpression: setScheduleCronExpression,
			setPrompt: setSchedulePrompt,
			setNotifySms: setScheduleNotifySms,
			setSmsTarget: setScheduleSmsTarget,
			close: closeScheduleDialog,
			submit: submitSchedule,
			isLoading: installRecipe.isPending || updateInstallation.isPending,
		},
		deleteDialog: {
			installation: installationToDelete,
			setInstallation: setInstallationToDelete,
			submit: submitDeleteInstallation,
			isLoading: deleteInstallation.isPending,
		},
		actions: {
			start,
			configureProvider,
			openConfigurationDialog,
			openScheduleDialog,
			toggleInstallationStatus,
			getRecipeCardState,
		},
	};
}
