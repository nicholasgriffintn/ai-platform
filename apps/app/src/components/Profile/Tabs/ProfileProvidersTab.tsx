import { KeyRound, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { recipeConnectorProviderSchema } from "@assistant/schemas";

import { EmptyState } from "~/components/Core/EmptyState";
import { ModelIcon } from "~/components/ModelIcon";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { ConfirmationDialog, HoverActions, ListItem } from "~/components/ui";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
	RECIPE_CONNECTORS_QUERY_KEY,
	useDisconnectRecipeConnector,
	useRecipeConnectors,
	useStartRecipeConnector,
} from "~/hooks/useConnectors";
import { useUser } from "~/hooks/useUser";
import { formatProviderLabel } from "~/lib/provider-display";
import type { ProviderSetting } from "~/lib/api/services/user-service";
import { ProviderApiKeyModal } from "../Modals/ProviderApiKeyModal";

interface ProviderModalState {
	open: boolean;
	providerId: string;
	providerName: string;
}

interface ProviderDeleteState {
	providerId: string;
	providerName: string;
}

type ProviderTypeFilter = "all" | "chat" | "connector";

export function ProfileProvidersTab() {
	const { trackEvent } = useTrackEvent();
	const queryClient = useQueryClient();

	const {
		providerSettings,
		isLoadingProviderSettings,
		syncProviders,
		isSyncingProviders,
		deleteProviderApiKey,
		isDeletingProviderApiKey,
	} = useUser();
	const [modalState, setModalState] = useState<ProviderModalState>({
		open: false,
		providerId: "",
		providerName: "",
	});
	const [providerToDelete, setProviderToDelete] = useState<ProviderDeleteState | null>(null);
	const [connectorToDelete, setConnectorToDelete] = useState<ProviderDeleteState | null>(null);
	const [providerType, setProviderType] = useState<ProviderTypeFilter>("all");
	const { data: connectorsData, isLoading: isLoadingConnectors } = useRecipeConnectors();
	const startConnector = useStartRecipeConnector();
	const disconnectConnector = useDisconnectRecipeConnector();
	const connectors = connectorsData?.connectors ?? [];
	const configuredProviderCount =
		providerSettings.filter((provider) => provider.hasApiKey).length +
		connectors.filter((connector) => connector.status === "connected").length;
	const totalProviderCount = providerSettings.length + connectors.length;
	const providerCounts = useMemo(
		() => ({
			all: providerSettings.length + connectors.length,
			chat: providerSettings.filter((provider) => provider.type !== "connector").length,
			connector: connectors.length,
		}),
		[connectors.length, providerSettings],
	);
	const filteredProviderSettings = useMemo(
		() =>
			providerSettings.filter((provider) => {
				if (providerType === "all") return true;
				if (providerType === "chat") return provider.type !== "connector";
				return provider.type === "connector";
			}),
		[providerSettings, providerType],
	);
	const filteredConnectors = useMemo(
		() => (providerType === "chat" ? [] : connectors),
		[connectors, providerType],
	);

	const getProviderName = (provider: ProviderSetting) =>
		provider.name || formatProviderLabel(provider.provider_id);

	const handleEnableProvider = (providerId: string, providerName: string) => {
		trackEvent({
			name: "open_enable_provider_modal",
			category: "profile",
			label: "enable_provider",
			value: providerId,
		});
		setModalState({
			open: true,
			providerId,
			providerName,
		});
	};

	const handleCloseModal = (open: boolean) => {
		trackEvent({
			name: "close_enable_provider_modal",
			category: "profile",
			label: "enable_provider",
			value: "",
		});
		setModalState({
			open,
			providerId: "",
			providerName: "",
		});
	};

	const handleDeleteProvider = async () => {
		if (!providerToDelete) {
			return;
		}

		trackEvent({
			name: "delete_provider_api_key",
			category: "profile",
			label: "delete_provider",
			value: providerToDelete.providerId,
		});
		await deleteProviderApiKey({ providerId: providerToDelete.providerId });
		setProviderToDelete(null);
	};

	const handleConnectConnector = async (providerId: (typeof connectors)[number]["id"]) => {
		try {
			const response = await startConnector.mutateAsync({
				provider: providerId,
				returnTo: "/profile?tab=providers&type=connector",
			});
			window.location.href = response.authorizationUrl;
		} catch (error) {
			console.error(error);
			toast.error("Could not start connector setup.");
		}
	};

	const handleDisconnectConnector = async () => {
		if (!connectorToDelete) {
			return;
		}

		const parsedProvider = recipeConnectorProviderSchema.safeParse(connectorToDelete.providerId);
		if (!parsedProvider.success) {
			toast.error("Unknown connector provider.");
			setConnectorToDelete(null);
			return;
		}

		await disconnectConnector.mutateAsync(parsedProvider.data);
		await queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY });
		setConnectorToDelete(null);
	};

	return (
		<div>
			<PageHeader
				actions={
					!isLoadingProviderSettings
						? [
								{
									label: isSyncingProviders ? "Syncing..." : "Sync Providers",
									onClick: () => syncProviders(),
									icon: <RefreshCcw className="h-4 w-4 mr-2" />,
									disabled: isSyncingProviders,
									variant: "secondary",
								},
							]
						: []
				}
			>
				<PageTitle title="Available Providers" />
			</PageHeader>

			<div className="space-y-4">
				{!isLoadingProviderSettings && providerSettings.length > 0 && (
					<div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
						{configuredProviderCount} of {totalProviderCount} providers configured
					</div>
				)}

				{!isLoadingProviderSettings && totalProviderCount > 0 && (
					<Tabs
						value={providerType}
						onValueChange={(value) => setProviderType(value as ProviderTypeFilter)}
					>
						<TabsList>
							<TabsTrigger value="all">All ({providerCounts.all})</TabsTrigger>
							<TabsTrigger value="chat">Chat ({providerCounts.chat})</TabsTrigger>
							<TabsTrigger value="connector">Connectors ({providerCounts.connector})</TabsTrigger>
						</TabsList>
					</Tabs>
				)}

				{isLoadingProviderSettings || isLoadingConnectors ? (
					<div className="flex justify-center py-10">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
					</div>
				) : totalProviderCount === 0 ? (
					<EmptyState
						message="No providers available"
						className="bg-transparent dark:bg-transparent border-none py-10 px-0"
					/>
				) : filteredProviderSettings.length === 0 && filteredConnectors.length === 0 ? (
					<EmptyState
						message="No providers in this type"
						className="bg-transparent dark:bg-transparent border-none py-10 px-0"
					/>
				) : (
					<ul className="space-y-2">
						{providerType !== "connector" &&
							filteredProviderSettings.map((provider: ProviderSetting) => {
								const providerName = getProviderName(provider);
								const isConfigured = Boolean(provider.hasApiKey);

								return (
									<ListItem
										key={provider.id}
										className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750"
										icon={
											<ModelIcon
												modelName={providerName}
												provider={provider.provider_id}
												size={22}
												showFallback
												mono
											/>
										}
										label={providerName}
										sublabel={provider.description}
										badge={
											isConfigured ? (
												<span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">
													<KeyRound className="h-3 w-3 mr-1" /> Configured
												</span>
											) : undefined
										}
										actions={
											<HoverActions
												alwaysVisible
												actions={[
													{
														id: "configure",
														icon: isConfigured ? <KeyRound size={14} /> : <Plus size={14} />,
														label: isConfigured ? "Update key" : "Add key",
														onClick: (e) => {
															e.stopPropagation();
															handleEnableProvider(provider.provider_id, providerName);
														},
													},
													...(isConfigured
														? [
																{
																	id: "delete",
																	icon:
																		isDeletingProviderApiKey &&
																		providerToDelete?.providerId === provider.provider_id ? (
																			<Loader2 size={14} className="animate-spin" />
																		) : (
																			<Trash2 size={14} />
																		),
																	label: `Delete provider ${providerName}`,
																	onClick: (e: React.MouseEvent) => {
																		e.stopPropagation();
																		setProviderToDelete({
																			providerId: provider.provider_id,
																			providerName,
																		});
																	},
																	disabled:
																		isDeletingProviderApiKey &&
																		providerToDelete?.providerId === provider.provider_id,
																},
															]
														: []),
												]}
											/>
										}
									/>
								);
							})}
						{filteredConnectors.map((connector) => {
							const isConnected = connector.status === "connected";
							const isUnavailable = connector.status === "unconfigured";

							return (
								<ListItem
									key={`connector-${connector.id}`}
									className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750"
									icon={
										<ModelIcon
											modelName={connector.name}
											provider={connector.id}
											size={22}
											showFallback
											mono
										/>
									}
									label={connector.name}
									sublabel={connector.description}
									badge={
										<span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-900/30 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300">
											<KeyRound className="h-3 w-3 mr-1" />
											{isConnected ? "Connected" : isUnavailable ? "Unavailable" : "Not connected"}
										</span>
									}
									actions={
										<HoverActions
											alwaysVisible
											actions={[
												{
													id: "connect",
													icon: startConnector.isPending ? (
														<Loader2 size={14} className="animate-spin" />
													) : (
														<Plus size={14} />
													),
													label: isConnected ? "Reconnect" : "Connect",
													onClick: (e) => {
														e.stopPropagation();
														handleConnectConnector(connector.id);
													},
													disabled: isUnavailable || startConnector.isPending,
												},
												...(isConnected && connector.authType !== "github_app"
													? [
															{
																id: "delete",
																icon:
																	disconnectConnector.isPending &&
																	connectorToDelete?.providerId === connector.id ? (
																		<Loader2 size={14} className="animate-spin" />
																	) : (
																		<Trash2 size={14} />
																	),
																label: `Disconnect ${connector.name}`,
																onClick: (e: React.MouseEvent) => {
																	e.stopPropagation();
																	setConnectorToDelete({
																		providerId: connector.id,
																		providerName: connector.name,
																	});
																},
																disabled: disconnectConnector.isPending,
															},
														]
													: []),
											]}
										/>
									}
								/>
							);
						})}
					</ul>
				)}
			</div>

			<ProviderApiKeyModal
				open={modalState.open}
				onOpenChange={handleCloseModal}
				providerId={modalState.providerId}
				providerName={modalState.providerName}
			/>
			<ConfirmationDialog
				open={providerToDelete !== null}
				onOpenChange={(open) => !open && setProviderToDelete(null)}
				title="Delete Provider"
				description={
					providerToDelete
						? `Delete the stored credentials for ${providerToDelete.providerName}? The provider will be disabled until you add a new key.`
						: ""
				}
				confirmText="Delete Provider"
				variant="destructive"
				onConfirm={handleDeleteProvider}
				isLoading={isDeletingProviderApiKey}
			/>
			<ConfirmationDialog
				open={connectorToDelete !== null}
				onOpenChange={(open) => !open && setConnectorToDelete(null)}
				title="Disconnect Connector"
				description={
					connectorToDelete
						? `Disconnect ${connectorToDelete.providerName}? Recipes using it will stop working until you reconnect.`
						: ""
				}
				confirmText="Disconnect Connector"
				variant="destructive"
				onConfirm={handleDisconnectConnector}
				isLoading={disconnectConnector.isPending}
			/>
		</div>
	);
}
