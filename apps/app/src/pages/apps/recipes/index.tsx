import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
	Clock,
	CalendarClock,
	MessageCircle,
	PauseCircle,
	PlayCircle,
	Plug,
	RefreshCw,
	SearchX,
	Settings2,
	Trash2,
	WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
	recipeConnectorProviderSchema,
	type AssistantRecipe,
	type RecipeConfiguration,
	type RecipeConfigurationField,
	type RecipeInstallation,
	type RecipeInstallationTrigger,
	type RecipeKind,
} from "@assistant/schemas";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	ConfirmationDialog,
	FormDialog,
	Input,
	Label,
	SearchInput,
	Textarea,
} from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import {
	ASSISTANT_RECIPES_QUERY_KEY,
	RECIPE_INSTALLATIONS_QUERY_KEY,
	useAssistantRecipes,
	useDeleteRecipeInstallation,
	useInstallAssistantRecipe,
	useRecipeInstallations,
	useUpdateRecipeInstallation,
} from "~/hooks/useRecipes";
import { RECIPE_CONNECTORS_QUERY_KEY, useStartRecipeConnector } from "~/hooks/useConnectors";
import { cn } from "~/lib/utils";

const kindLabels: Record<RecipeKind | "all", string> = {
	all: "All recipes",
	automate: "Automations",
	integrate: "Integrations",
};

function integrationStatusLabel(status: string | undefined) {
	if (status === "connected") return "Connected";
	if (status === "not_required") return "Built in";
	if (status === "missing") return "Connect";
	if (status === "unconfigured") return "Unavailable";
	return "Unknown";
}

function getMissingIntegrations(recipe: AssistantRecipe) {
	return recipe.integrations.filter(
		(integration) =>
			integration.requiresConnection &&
			(integration.connectionStatus === "missing" ||
				integration.connectionStatus === "unknown" ||
				integration.connectionStatus === "unconfigured"),
	);
}

function isRecipeReady(recipe: AssistantRecipe) {
	return recipe.integrations.every(
		(integration) =>
			integration.connectionStatus === "connected" ||
			integration.connectionStatus === "not_required",
	);
}

type ConfigurationFormValues = Record<string, string | boolean>;

function formatConfigurationValue(
	field: RecipeConfigurationField,
	configuration: RecipeConfiguration,
): string | boolean {
	const value = configuration[field.key] ?? field.defaultValue;
	if (field.type === "boolean") {
		return typeof value === "boolean" ? value : false;
	}
	if (field.type === "string_list") {
		return Array.isArray(value) ? value.join("\n") : "";
	}
	if (typeof value === "number") {
		return String(value);
	}
	return typeof value === "string" ? value : "";
}

function buildConfigurationFromFields(
	fields: RecipeConfigurationField[],
	values: ConfigurationFormValues,
): RecipeConfiguration {
	const configuration: RecipeConfiguration = {};

	for (const field of fields) {
		const value = values[field.key];
		if (field.type === "boolean") {
			configuration[field.key] = value === true;
			continue;
		}
		if (typeof value !== "string") {
			continue;
		}

		const trimmedValue = value.trim();
		if (!trimmedValue) {
			continue;
		}

		if (field.type === "number") {
			const numberValue = Number(trimmedValue);
			if (Number.isFinite(numberValue)) {
				configuration[field.key] = numberValue;
			}
			continue;
		}
		if (field.type === "string_list") {
			const listValue = trimmedValue
				.split(/[,\n]/)
				.map((item) => item.trim())
				.filter(Boolean);
			if (listValue.length > 0) {
				configuration[field.key] = listValue;
			}
			continue;
		}

		configuration[field.key] = trimmedValue;
	}

	return configuration;
}

function isRequiredConfigurationMissing(
	fields: RecipeConfigurationField[],
	values: ConfigurationFormValues,
) {
	return fields.some((field) => {
		if (!field.required) {
			return false;
		}
		const value = values[field.key];
		return field.type === "boolean" ? value !== true : typeof value !== "string" || !value.trim();
	});
}

function ConfigurationFieldInput({
	field,
	value,
	onChange,
}: {
	field: RecipeConfigurationField;
	value: string | boolean;
	onChange: (value: string | boolean) => void;
}) {
	if (field.type === "boolean") {
		return (
			<div className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
				<Checkbox
					id={`recipe-configuration-${field.key}`}
					checked={value === true}
					onCheckedChange={(checked) => onChange(checked === true)}
				/>
				<div className="space-y-1">
					<Label htmlFor={`recipe-configuration-${field.key}`}>{field.label}</Label>
					{field.description && (
						<p className="text-sm text-zinc-500 dark:text-zinc-400">{field.description}</p>
					)}
				</div>
			</div>
		);
	}

	const inputValue = typeof value === "string" ? value : "";
	return (
		<div className="space-y-2">
			<Label htmlFor={`recipe-configuration-${field.key}`}>
				{field.label}
				{field.required && <span className="text-red-500"> *</span>}
			</Label>
			{field.type === "textarea" || field.type === "string_list" ? (
				<Textarea
					id={`recipe-configuration-${field.key}`}
					value={inputValue}
					onChange={(event) => onChange(event.target.value)}
					rows={field.type === "string_list" ? 3 : 5}
					placeholder={
						field.placeholder ??
						(field.type === "string_list" ? "One item per line or comma separated" : undefined)
					}
				/>
			) : (
				<Input
					id={`recipe-configuration-${field.key}`}
					type={field.type === "number" ? "number" : "text"}
					value={inputValue}
					onChange={(event) => onChange(event.target.value)}
					placeholder={field.placeholder}
				/>
			)}
			{field.description && (
				<p className="text-sm text-zinc-500 dark:text-zinc-400">{field.description}</p>
			)}
		</div>
	);
}

function RecipeCard({
	recipe,
	installation,
	onStart,
	onConfigure,
	onEditConfiguration,
	onSchedule,
	onToggleInstallationStatus,
	onDeleteInstallation,
	isStarting,
	isConfiguring,
	isEditingConfiguration,
	isScheduling,
	isUpdatingInstallation,
}: {
	recipe: AssistantRecipe;
	installation?: RecipeInstallation;
	onStart: (recipe: AssistantRecipe) => void;
	onConfigure: (providerId: string, setupUrl?: string) => void;
	onEditConfiguration: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
	onSchedule: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
	onToggleInstallationStatus: (installation: RecipeInstallation) => void;
	onDeleteInstallation: (installation: RecipeInstallation) => void;
	isStarting: boolean;
	isConfiguring: boolean;
	isEditingConfiguration: boolean;
	isScheduling: boolean;
	isUpdatingInstallation: boolean;
}) {
	const missingIntegrations = getMissingIntegrations(recipe);
	const isReady = isRecipeReady(recipe);
	const canSchedule = recipe.triggers.some((trigger) => trigger.type === "schedule");
	const scheduleTrigger = installation?.triggers.find((trigger) => trigger.type === "schedule");
	const isPaused = installation?.status === "paused";
	const hasConfiguration =
		installation?.configuration &&
		Object.values(installation.configuration).some((value) => value !== null && value !== "");

	return (
		<Card className="flex h-full flex-col border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
			<CardHeader className="space-y-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2">
						<div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
							{recipe.kind === "automate" ? (
								<WandSparkles className="h-4 w-4" />
							) : (
								<Plug className="h-4 w-4" />
							)}
						</div>
						<Badge variant="outline">{kindLabels[recipe.kind]}</Badge>
					</div>
					{recipe.featured && (
						<Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
							Featured
						</Badge>
					)}
				</div>
				<div>
					<CardTitle className="text-lg">{recipe.title}</CardTitle>
					<CardDescription className="mt-1 leading-6">{recipe.summary}</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{recipe.description}</p>

				<div className="flex flex-wrap gap-2">
					{installation && (
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
								isPaused
									? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
									: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
							)}
						>
							{isPaused ? "Paused" : "Installed"}
						</span>
					)}
					{hasConfiguration && (
						<span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
							Configured
						</span>
					)}
					{recipe.integrations.map((integration) => (
						<span
							key={integration.id}
							className={cn(
								"inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
								integration.connectionStatus === "connected"
									? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
									: integration.connectionStatus === "not_required"
										? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
										: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
							)}
						>
							{integration.name}
							<span className="text-[11px] opacity-80">
								{integrationStatusLabel(integration.connectionStatus)}
							</span>
						</span>
					))}
				</div>

				<div className="grid gap-2 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-zinc-400" />
						<span>{recipe.estimatedSetupMinutes} min setup</span>
					</div>
					<div className="flex items-center gap-2">
						<MessageCircle className="h-4 w-4 text-zinc-400" />
						<span>{isReady ? "Ready for guided chat" : "Setup checks included"}</span>
					</div>
				</div>

				<div className="mt-auto space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
					{missingIntegrations.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{missingIntegrations.map((integration) => (
								<Button
									key={integration.id}
									variant="outline"
									size="xs"
									icon={<Plug className="h-3.5 w-3.5" />}
									onClick={() => onConfigure(integration.providerId, integration.setupUrl)}
									isLoading={isConfiguring}
									disabled={integration.connectionStatus === "unconfigured"}
								>
									Connect {integration.name}
								</Button>
							))}
						</div>
					)}
					<Button
						variant="primary"
						fullWidth
						onClick={() => onStart(recipe)}
						isLoading={isStarting}
					>
						Set up in chat
					</Button>
					<Button
						variant="secondary"
						fullWidth
						icon={<Settings2 className="h-4 w-4" />}
						onClick={() => onEditConfiguration(recipe, installation)}
						isLoading={isEditingConfiguration}
					>
						{installation ? "Edit configuration" : "Configure"}
					</Button>
					{canSchedule && (
						<Button
							variant="secondary"
							fullWidth
							icon={<CalendarClock className="h-4 w-4" />}
							onClick={() => onSchedule(recipe, installation)}
							isLoading={isScheduling}
						>
							{scheduleTrigger ? "Edit schedule" : "Schedule"}
						</Button>
					)}
					{installation && (
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								size="sm"
								icon={
									isPaused ? (
										<PlayCircle className="h-4 w-4" />
									) : (
										<PauseCircle className="h-4 w-4" />
									)
								}
								onClick={() => onToggleInstallationStatus(installation)}
								isLoading={isUpdatingInstallation}
							>
								{isPaused ? "Resume" : "Pause"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								icon={<Trash2 className="h-4 w-4" />}
								onClick={() => onDeleteInstallation(installation)}
								disabled={isUpdatingInstallation}
							>
								Remove
							</Button>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

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
	const [kind, setKind] = useState<RecipeKind | "all">("all");
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

	const handleStart = async (recipe: AssistantRecipe) => {
		try {
			const setup = await installRecipe.mutateAsync({ recipeId: recipe.id });
			navigate(setup.messageUrl);
		} catch (startError) {
			console.error(startError);
			toast.error("Could not start recipe setup. Please try again.");
		}
	};

	const handleScheduleRecipe = async () => {
		if (!scheduleRecipe) {
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
				formatConfigurationValue(field, configuration),
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

		const configuration = buildConfigurationFromFields(
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
		const scheduleTrigger = installation?.triggers.find((trigger) => trigger.type === "schedule");
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
			<div className="mb-6 grid gap-3 md:grid-cols-3">
				<Card className="p-4">
					<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
						{recipes.length}
					</div>
					<div className="text-sm text-zinc-500 dark:text-zinc-400">Available recipes</div>
				</Card>
				<Card className="p-4">
					<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
						{automationCount}
					</div>
					<div className="text-sm text-zinc-500 dark:text-zinc-400">Automations</div>
				</Card>
				<Card className="p-4">
					<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
						{installedRecipeIds.size}
					</div>
					<div className="text-sm text-zinc-500 dark:text-zinc-400">Configured</div>
				</Card>
			</div>

			<div className="mb-6 space-y-4">
				<SearchInput
					value={search}
					onChange={setSearch}
					placeholder="Search recipes, providers, actions..."
					className="max-w-xl"
				/>

				<div className="flex flex-wrap gap-2">
					{(Object.keys(kindLabels) as Array<RecipeKind | "all">).map((nextKind) => (
						<Button
							key={nextKind}
							variant={kind === nextKind ? "primary" : "secondary"}
							size="sm"
							onClick={() => setKind(nextKind)}
						>
							{kindLabels[nextKind]}
						</Button>
					))}
				</div>

				<div className="flex flex-wrap gap-2">
					{categories.map((nextCategory) => (
						<button
							key={nextCategory}
							type="button"
							onClick={() => setCategory(nextCategory)}
							className={cn(
								"rounded-md border px-3 py-1.5 text-sm transition-colors",
								category === nextCategory
									? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
									: "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
							)}
						>
							{nextCategory}
						</button>
					))}
				</div>
			</div>

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
								installRecipe.isPending &&
								installRecipe.variables?.recipeId === recipe.id &&
								!installRecipe.variables?.triggers
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

			<FormDialog
				open={configurationRecipe !== null}
				onOpenChange={(open) => {
					if (!open) {
						setConfigurationRecipe(null);
						setConfigurationInstallation(null);
						setConfigurationValues({});
					}
				}}
				title={configurationRecipe ? `Configure ${configurationRecipe.title}` : "Configure recipe"}
				onSubmit={handleSaveConfiguration}
				submitText={configurationInstallation ? "Save configuration" : "Install recipe"}
				isLoading={installRecipe.isPending || updateInstallation.isPending}
				submitDisabled={
					configurationRecipe
						? isRequiredConfigurationMissing(
								configurationRecipe.configurationFields,
								configurationValues,
							)
						: false
				}
			>
				{configurationRecipe?.configurationFields.length ? (
					configurationRecipe.configurationFields.map((field) => (
						<ConfigurationFieldInput
							key={field.key}
							field={field}
							value={configurationValues[field.key] ?? formatConfigurationValue(field, {})}
							onChange={(value) =>
								setConfigurationValues((current) => ({
									...current,
									[field.key]: value,
								}))
							}
						/>
					))
				) : (
					<p className="text-sm text-zinc-500 dark:text-zinc-400">
						This recipe does not need saved configuration.
					</p>
				)}
			</FormDialog>
			<FormDialog
				open={scheduleRecipe !== null}
				onOpenChange={(open) => {
					if (!open) {
						setScheduleRecipe(null);
						setScheduleInstallation(null);
						setScheduleNotifySms(false);
						setScheduleSmsTarget("");
					}
				}}
				title={scheduleRecipe ? `Schedule ${scheduleRecipe.title}` : "Schedule recipe"}
				onSubmit={handleScheduleRecipe}
				submitText={scheduleInstallation ? "Save schedule" : "Schedule"}
				isLoading={installRecipe.isPending || updateInstallation.isPending}
				submitDisabled={
					!scheduleCronExpression.trim() || (scheduleNotifySms && !scheduleSmsTarget.trim())
				}
			>
				<div className="space-y-2">
					<Label htmlFor="recipe-cron-expression">Cron expression</Label>
					<Input
						id="recipe-cron-expression"
						value={scheduleCronExpression}
						onChange={(event) => setScheduleCronExpression(event.target.value)}
						placeholder="0 9 * * *"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="recipe-schedule-prompt">Prompt</Label>
					<Textarea
						id="recipe-schedule-prompt"
						value={schedulePrompt}
						onChange={(event) => setSchedulePrompt(event.target.value)}
						rows={5}
					/>
				</div>
				<div className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
					<label className="flex items-start gap-3">
						<Checkbox
							checked={scheduleNotifySms}
							onCheckedChange={(checked) => setScheduleNotifySms(checked === true)}
						/>
						<span>
							<span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
								Send result by SMS
							</span>
							<span className="block text-sm text-zinc-500 dark:text-zinc-400">
								Uses your configured Twilio or AWS SMS provider.
							</span>
						</span>
					</label>
					{scheduleNotifySms && (
						<div className="space-y-2">
							<Label htmlFor="recipe-sms-target">SMS target</Label>
							<Input
								id="recipe-sms-target"
								value={scheduleSmsTarget}
								onChange={(event) => setScheduleSmsTarget(event.target.value)}
								placeholder="+44......."
							/>
						</div>
					)}
				</div>
			</FormDialog>
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
