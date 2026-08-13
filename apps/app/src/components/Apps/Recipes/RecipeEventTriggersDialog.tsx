import { Activity, AlertTriangle, PauseCircle, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
	AssistantRecipe,
	ComposioTriggerType,
	RecipeComposioTrigger,
	RecipeConnectorAccount,
	RecipeConnectorProvider,
	RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";

import {
	Badge,
	Button,
	ConfirmationDialog,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FormInput,
	FormSelect,
	Switch,
} from "@ngriffin_uk/polychat-component-ui";
import { useRecipeConnectorAccounts } from "~/hooks/useConnectors";
import { getErrorMessage } from "~/lib/errors";
import {
	buildRecipeTriggerConfiguration,
	formatRecipeTriggerIdentifier,
	getRecipeTriggerConfigurationFields,
	type RecipeTriggerConfigurationField,
	type RecipeTriggerConfigurationValue,
} from "~/lib/recipe-composio-trigger-configuration";
import { useRecipeComposioTriggers } from "./useRecipeComposioTriggers";

export interface RecipeEventTriggerProvider {
	id: RecipeConnectorProvider;
	name: string;
}

interface RecipeEventTriggersDialogProps {
	recipe: AssistantRecipe;
	installation: RecipeInstallation;
	providers: RecipeEventTriggerProvider[];
	onClose: () => void;
}

function ConfigurationFields({
	fields,
	values,
	onChange,
}: {
	fields: RecipeTriggerConfigurationField[];
	values: Record<string, RecipeTriggerConfigurationValue>;
	onChange: (key: string, value: RecipeTriggerConfigurationValue) => void;
}) {
	return fields.map((field) => {
		if (field.type === "boolean") {
			return (
				<Switch
					key={field.key}
					id={`recipe-event-${field.key}`}
					label={field.label}
					description={field.description}
					checked={values[field.key] === true}
					onChange={(event) => onChange(field.key, event.target.checked)}
				/>
			);
		}
		if (field.type === "select") {
			return (
				<FormSelect
					key={field.key}
					label={field.label}
					description={field.description}
					required={field.required}
					value={String(values[field.key] ?? "")}
					onChange={(event) => onChange(field.key, event.target.value)}
					options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
				/>
			);
		}
		return (
			<FormInput
				key={field.key}
				label={field.label}
				description={field.description}
				type={field.type === "number" ? "number" : "text"}
				required={field.required}
				value={String(values[field.key] ?? "")}
				onChange={(event) => onChange(field.key, event.target.value)}
			/>
		);
	});
}

function TriggerList({
	triggers,
	triggerTypes,
	providers,
	onSetStatus,
	onDelete,
	isUpdating,
	isDeleting,
}: {
	triggers: RecipeComposioTrigger[];
	triggerTypes: ComposioTriggerType[];
	providers: RecipeEventTriggerProvider[];
	onSetStatus: (trigger: RecipeComposioTrigger, status: "active" | "paused") => void;
	onDelete: (trigger: RecipeComposioTrigger) => void;
	isUpdating: (trigger: RecipeComposioTrigger) => boolean;
	isDeleting: (trigger: RecipeComposioTrigger) => boolean;
}) {
	if (triggers.length === 0) {
		return (
			<p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
				No event triggers yet.
			</p>
		);
	}

	return (
		<ul className="space-y-2">
			{triggers.map((trigger) => {
				const provider = providers.find((candidate) => candidate.id === trigger.providerId);
				const triggerType = triggerTypes.find(
					(candidate) => candidate.slug === trigger.triggerSlug,
				);
				const eventName = triggerType?.name ?? formatRecipeTriggerIdentifier(trigger.triggerSlug);
				const active = trigger.status === "active";
				return (
					<li
						key={trigger.id}
						className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
									{eventName}
								</p>
								<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
									{provider?.name ?? "Connected integration"}
								</p>
							</div>
							<Badge variant={trigger.status === "error" ? "destructive" : "outline"}>
								{trigger.status === "error" ? "Needs attention" : active ? "Active" : "Paused"}
							</Badge>
						</div>
						<div className="mt-3 flex gap-2">
							<Button
								variant="outline"
								size="xs"
								icon={
									active ? (
										<PauseCircle className="h-3.5 w-3.5" />
									) : (
										<PlayCircle className="h-3.5 w-3.5" />
									)
								}
								onClick={() => onSetStatus(trigger, active ? "paused" : "active")}
								isLoading={isUpdating(trigger)}
							>
								{active ? "Pause" : "Resume"}
							</Button>
							<Button
								variant="outline"
								size="xs"
								icon={<Trash2 className="h-3.5 w-3.5" />}
								onClick={() => onDelete(trigger)}
								isLoading={isDeleting(trigger)}
								aria-label={`Delete ${eventName} event trigger`}
							>
								Delete
							</Button>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function getAccountOptions(accounts: RecipeConnectorAccount[], providerName: string) {
	return accounts.map((account, index) => ({
		value: account.id,
		label: account.alias?.trim() || `${providerName} account ${index + 1}`,
	}));
}

export function RecipeEventTriggersDialog({
	recipe,
	installation,
	providers,
	onClose,
}: RecipeEventTriggersDialogProps) {
	const [providerId, setProviderId] = useState(providers[0]?.id ?? "github");
	const [accountId, setAccountId] = useState("");
	const [triggerSlug, setTriggerSlug] = useState("");
	const [configurationValues, setConfigurationValues] = useState<
		Record<string, RecipeTriggerConfigurationValue>
	>({});
	const [validationError, setValidationError] = useState<string>();
	const [triggerToDelete, setTriggerToDelete] = useState<RecipeComposioTrigger | null>(null);
	const provider = providers.find((candidate) => candidate.id === providerId) ?? providers[0];
	const accountsQuery = useRecipeConnectorAccounts(providerId);
	const manager = useRecipeComposioTriggers(installation.id, providerId);
	const activeAccounts = useMemo(
		() =>
			(accountsQuery.data?.accounts ?? []).filter(
				(account) => account.status === "ACTIVE" && !account.isDisabled,
			),
		[accountsQuery.data?.accounts],
	);
	const triggerTypes = manager.triggerTypes.data?.triggerTypes ?? [];
	const selectedTriggerType = triggerTypes.find((type) => type.slug === triggerSlug);
	const configuration = getRecipeTriggerConfigurationFields(
		selectedTriggerType?.configuration ?? {},
	);

	useEffect(() => {
		const selected = activeAccounts.find((account) => account.isSelected) ?? activeAccounts[0];
		setAccountId(selected?.id ?? "");
	}, [activeAccounts]);

	useEffect(() => {
		setTriggerSlug(triggerTypes[0]?.slug ?? "");
	}, [triggerTypes]);

	useEffect(() => {
		setConfigurationValues(
			Object.fromEntries(configuration.fields.map((field) => [field.key, field.defaultValue])),
		);
		setValidationError(undefined);
	}, [triggerSlug]);

	const submit = async () => {
		if (!provider || !accountId || !selectedTriggerType) return;
		if (configuration.unsupportedRequiredLabels.length > 0) {
			setValidationError("This event needs configuration that is not supported here yet.");
			return;
		}
		const result = buildRecipeTriggerConfiguration(configuration.fields, configurationValues);
		if (result.error) {
			setValidationError(result.error);
			return;
		}
		setValidationError(undefined);
		await manager.createTrigger.mutateAsync({
			providerId: provider.id,
			connectedAccountId: accountId,
			triggerSlug: selectedTriggerType.slug,
			configuration: result.configuration,
		});
	};

	const requestError =
		accountsQuery.error ??
		manager.triggerTypes.error ??
		manager.triggers.error ??
		manager.createTrigger.error ??
		manager.updateTrigger.error ??
		manager.deleteTrigger.error;
	const isLoading =
		accountsQuery.isLoading || manager.triggerTypes.isLoading || manager.triggers.isLoading;
	const canCreate =
		Boolean(provider && accountId && selectedTriggerType) &&
		configuration.unsupportedRequiredLabels.length === 0;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<div className="mb-1 flex items-center gap-2 text-blue-600 dark:text-blue-400">
						<Activity className="h-4 w-4" />
						<span className="text-xs font-semibold uppercase tracking-wide">Live automation</span>
					</div>
					<DialogTitle>Event triggers for {recipe.title}</DialogTitle>
					<DialogDescription>
						Run this installed recipe when a selected connected app reports an event.
					</DialogDescription>
				</DialogHeader>

				{requestError && (
					<div
						role="alert"
						className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
					>
						{getErrorMessage(requestError, "Could not load or update event triggers.")}
					</div>
				)}

				{isLoading ? (
					<p role="status" className="py-8 text-center text-sm text-zinc-500">
						Loading event options…
					</p>
				) : (
					<div className="grid gap-6 py-2 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
						<form
							className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
							noValidate
							onSubmit={(event) => {
								event.preventDefault();
								void submit().catch(() => undefined);
							}}
						>
							<div>
								<h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
									Add a live event
								</h3>
								<p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
									Choose exactly which account and event can start this recipe.
								</p>
							</div>
							{providers.length > 1 && (
								<FormSelect
									label="Integration"
									value={providerId}
									onChange={(event) => setProviderId(event.target.value)}
									options={providers.map((item) => ({ value: item.id, label: item.name }))}
								/>
							)}
							<FormSelect
								label="Connected account"
								value={accountId}
								onChange={(event) => setAccountId(event.target.value)}
								options={getAccountOptions(activeAccounts, provider?.name ?? "Connected")}
								description={
									activeAccounts.length === 0
										? "Connect and name an account before adding an event."
										: "Only this account can start the recipe."
								}
							/>
							<FormSelect
								label="Event"
								value={triggerSlug}
								onChange={(event) => setTriggerSlug(event.target.value)}
								options={triggerTypes.map((type) => ({ value: type.slug, label: type.name }))}
								description={selectedTriggerType?.description ?? "No live events are available."}
							/>
							<ConfigurationFields
								fields={configuration.fields}
								values={configurationValues}
								onChange={(key, value) =>
									setConfigurationValues((current) => ({ ...current, [key]: value }))
								}
							/>
							{configuration.unsupportedRequiredLabels.length > 0 && (
								<p role="alert" className="flex gap-2 text-sm text-amber-700 dark:text-amber-300">
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
									This event requires advanced configuration that is not supported here yet.
								</p>
							)}
							{validationError && (
								<p role="alert" className="text-sm text-red-600 dark:text-red-400">
									{validationError}
								</p>
							)}
							<Button
								type="submit"
								variant="primary"
								fullWidth
								icon={<Plus className="h-4 w-4" />}
								disabled={!canCreate}
								isLoading={manager.createTrigger.isPending}
							>
								Create event trigger
							</Button>
						</form>

						<section aria-labelledby="active-event-triggers" className="space-y-3">
							<div>
								<h3
									id="active-event-triggers"
									className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
								>
									Installed events
								</h3>
								<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
									Pause an event without removing its setup.
								</p>
							</div>
							<TriggerList
								triggers={manager.triggers.data?.triggers ?? []}
								triggerTypes={triggerTypes}
								providers={providers}
								onSetStatus={(trigger, status) =>
									manager.updateTrigger.mutate({ triggerId: trigger.id, status })
								}
								onDelete={setTriggerToDelete}
								isUpdating={(trigger) =>
									manager.updateTrigger.isPending &&
									manager.updateTrigger.variables?.triggerId === trigger.id
								}
								isDeleting={(trigger) =>
									manager.deleteTrigger.isPending && manager.deleteTrigger.variables === trigger.id
								}
							/>
						</section>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Done
					</Button>
				</DialogFooter>
				<ConfirmationDialog
					open={triggerToDelete !== null}
					onOpenChange={(open) => !open && setTriggerToDelete(null)}
					title="Delete event trigger?"
					description="This stops the connected app event from starting this recipe. This cannot be undone."
					confirmText="Delete trigger"
					variant="destructive"
					isLoading={manager.deleteTrigger.isPending}
					onConfirm={async () => {
						if (!triggerToDelete) return;
						await manager.deleteTrigger.mutateAsync(triggerToDelete.id);
						setTriggerToDelete(null);
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}
