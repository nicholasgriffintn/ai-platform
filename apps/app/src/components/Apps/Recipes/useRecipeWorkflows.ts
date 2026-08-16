import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
	type AssistantRecipe,
	type RecipeConnectorManifest,
	type RecipeInstallation,
	type RecipeInstallationTrigger,
} from "@ngriffin_uk/polychat-schemas";

import { useRecipeConnectors } from "~/hooks/useConnectors";
import {
	ASSISTANT_RECIPES_QUERY_KEY,
	useDeleteRecipeInstallation,
	useInstallAssistantRecipe,
	useInvokeAssistantRecipe,
	useUpdateRecipeInstallation,
} from "~/hooks/useRecipes";
import { createRecipeConversationActionPath } from "~/lib/assistant-action-launch";
import { useConnectorSetup } from "~/hooks/useConnectorSetup";
import {
	buildRecipeConfigurationFromFields,
	type ConfigurationFormValues,
	formatRecipeConfigurationValue,
	getMissingRequiredRecipeConfigurationFields,
	getRecipeScheduleTrigger,
	isRecipeScheduleCronSupported,
} from "~/lib/recipes";
import type { RecipeEventTriggerProvider } from "./RecipeEventTriggersDialog";
import { getRecipeEventTriggerProviders } from "./recipeEventTriggerProviders";

interface RecipeEventDialogState {
	recipe: AssistantRecipe;
	installation: RecipeInstallation;
	providers: RecipeEventTriggerProvider[];
}

export function useRecipeWorkflows({
	conversationPath,
	projectId,
}: { conversationPath?: string; projectId?: string } = {}) {
	const navigate = useNavigate();
	const location = useLocation();
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
	const [continueToSchedule, setContinueToSchedule] = useState(false);
	const [eventDialog, setEventDialog] = useState<RecipeEventDialogState | null>(null);
	const installRecipe = useInstallAssistantRecipe();
	const invokeRecipe = useInvokeAssistantRecipe();
	const updateInstallation = useUpdateRecipeInstallation();
	const deleteInstallation = useDeleteRecipeInstallation();
	const { data: connectorsData } = useRecipeConnectors();
	const connectorSetup = useConnectorSetup({
		returnTo: `${location.pathname}${location.search}`,
		onConnected: () => queryClient.invalidateQueries({ queryKey: ASSISTANT_RECIPES_QUERY_KEY }),
	});
	const connectorByProviderId = useMemo<Map<string, RecipeConnectorManifest>>(
		() =>
			new Map<string, RecipeConnectorManifest>(
				(connectorsData?.connectors ?? []).map((connector) => [connector.id, connector]),
			),
		[connectorsData?.connectors],
	);
	const scheduleCronIsSupported = isRecipeScheduleCronSupported(scheduleCronExpression);

	const start = (recipe: AssistantRecipe, installation?: RecipeInstallation) => {
		navigate(
			createRecipeConversationActionPath(conversationPath ?? "/", {
				action: installation ? "run" : "setup",
				recipeId: recipe.id,
			}),
		);
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
					projectId,
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
		options: { continueToSchedule?: boolean } = {},
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
		setContinueToSchedule(options.continueToSchedule ?? false);
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
			let savedInstallation: RecipeInstallation;
			if (configurationInstallation) {
				savedInstallation = await updateInstallation.mutateAsync({
					installationId: configurationInstallation.id,
					update: { configuration },
				});
			} else {
				const setup = await installRecipe.mutateAsync({
					recipeId: configurationRecipe.id,
					projectId,
					configuration,
				});
				if (!setup.installation) {
					throw new Error("Recipe installation was not returned after saving configuration");
				}
				savedInstallation = setup.installation;
			}
			const shouldContinueToSchedule = continueToSchedule;
			const savedRecipe = configurationRecipe;
			setConfigurationRecipe(null);
			setConfigurationInstallation(null);
			setContinueToSchedule(false);
			if (shouldContinueToSchedule) {
				const scheduleTrigger = getRecipeScheduleTrigger(savedInstallation);
				setScheduleRecipe(savedRecipe);
				setScheduleInstallation(savedInstallation);
				setScheduleCronExpression(scheduleTrigger?.cronExpression ?? "0 9 * * *");
				setSchedulePrompt(scheduleTrigger?.prompt ?? savedRecipe.setupPrompt);
				setScheduleNotifySms(scheduleTrigger?.notificationChannel === "sms");
				setScheduleSmsTarget(scheduleTrigger?.notificationTarget ?? "");
			}
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
			openConfigurationDialog(nextRecipe, installation, { continueToSchedule: true });
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

	const setScheduleEnabled = async (installation: RecipeInstallation, enabled: boolean) => {
		try {
			await updateInstallation.mutateAsync({
				installationId: installation.id,
				update: {
					status: enabled ? "active" : installation.status,
					triggers: installation.triggers.map((trigger) =>
						trigger.type === "schedule" ? { ...trigger, enabled } : trigger,
					),
				},
			});
			toast.success(enabled ? "Recipe schedule resumed." : "Recipe schedule paused.");
		} catch (updateError) {
			console.error(updateError);
			toast.error("Could not update recipe schedule.");
		}
	};

	const stopSchedule = async (installation: RecipeInstallation) => {
		try {
			await updateInstallation.mutateAsync({
				installationId: installation.id,
				update: {
					triggers: installation.triggers.filter((trigger) => trigger.type !== "schedule"),
				},
			});
			toast.success("Recipe schedule stopped.");
		} catch (updateError) {
			console.error(updateError);
			toast.error("Could not stop recipe schedule.");
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

		await connectorSetup.connect(connector);
	};

	const openEventTriggersDialog = (recipe: AssistantRecipe, installation: RecipeInstallation) => {
		const providers = getRecipeEventTriggerProviders(recipe, connectorByProviderId);
		if (providers.length === 0) {
			toast.error("Connect a supported integration before adding an event trigger.");
			return;
		}
		setEventDialog({ recipe, installation, providers });
	};

	const closeConfigurationDialog = () => {
		setConfigurationRecipe(null);
		setConfigurationInstallation(null);
		setConfigurationValues({});
		setContinueToSchedule(false);
	};

	const closeScheduleDialog = () => {
		setScheduleRecipe(null);
		setScheduleInstallation(null);
		setScheduleNotifySms(false);
		setScheduleSmsTarget("");
	};

	const getRecipeCardState = (recipe: AssistantRecipe, installation?: RecipeInstallation) => ({
		installation,
		canManageEventTriggers:
			Boolean(installation) &&
			getRecipeEventTriggerProviders(recipe, connectorByProviderId).length > 0,
		isStarting:
			(installRecipe.isPending &&
				installRecipe.variables?.recipeId === recipe.id &&
				!installRecipe.variables?.triggers) ||
			(invokeRecipe.isPending && invokeRecipe.variables?.recipeId === recipe.id),
		isConfiguring: connectorSetup.isStarting,
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
		connectorSetup,
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
		eventDialog: {
			recipe: eventDialog?.recipe ?? null,
			installation: eventDialog?.installation ?? null,
			providers: eventDialog?.providers ?? [],
			close: () => setEventDialog(null),
		},
		actions: {
			start,
			configureProvider,
			openConfigurationDialog,
			openScheduleDialog,
			openEventTriggersDialog,
			setScheduleEnabled,
			stopSchedule,
			toggleInstallationStatus,
			getRecipeCardState,
		},
	};
}
