import { RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";
import type { RecipeConnectorManifest } from "@ngriffin_uk/polychat-schemas";

import { EmptyState } from "~/components/Core/EmptyState";
import { ModelIcon } from "~/components/ModelIcon";
import { PageShell } from "~/components/Core/PageShell";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	ConfirmationDialog,
	SearchInput,
} from "@ngriffin_uk/polychat-component-ui";
import { Tabs, TabsList, TabsTrigger } from "@ngriffin_uk/polychat-component-ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
	RECIPE_CONNECTORS_QUERY_KEY,
	useDisconnectRecipeConnector,
	useRecipeConnectors,
} from "~/hooks/useConnectors";
import { useConnectorSetup } from "~/hooks/useConnectorSetup";
import { useUser } from "~/hooks/useUser";
import { formatProviderLabel } from "~/lib/provider-display";
import type { ProviderSetting } from "~/lib/api/services/user-service";
import { completeConnectorAuthPopup } from "~/lib/connector-auth-popup";
import { ConnectorSetupDialogs } from "~/components/Connectors/ConnectorSetupDialogs";
import { ConnectorDetailsModal } from "../Connectors/ConnectorDetailsModal";
import { ConnectorLogo } from "../Connectors/ConnectorLogo";
import { ProviderApiKeyModal } from "../Modals/ProviderApiKeyModal";
import { ProviderCatalogue, type ProviderCatalogueItem } from "../Providers/ProviderCatalogue";

interface ProviderModalState {
	open: boolean;
	providerId: string;
	providerName: string;
}

interface ProviderDeleteState {
	providerId: string;
	providerName: string;
}

type ProviderTypeFilter = "all" | "connected" | "chat" | "messaging" | "connector";

function readProviderTypeFilter(value: string | null): ProviderTypeFilter {
	switch (value) {
		case "connected":
		case "chat":
		case "messaging":
		case "connector":
			return value;
		default:
			return "all";
	}
}

export function ProfileProvidersTab() {
	const { trackEvent } = useTrackEvent();
	const queryClient = useQueryClient();
	const [searchParams, setSearchParams] = useSearchParams();

	const {
		providerSettings,
		isLoadingProviderSettings,
		providerSyncRequired,
		isLoadingProviderSyncStatus,
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
	const [selectedConnector, setSelectedConnector] = useState<RecipeConnectorManifest | null>(null);
	const providerType = readProviderTypeFilter(searchParams.get("type"));
	const [providerSearch, setProviderSearch] = useState("");
	const { data: connectorsData, isLoading: isLoadingConnectors } = useRecipeConnectors();
	const connectorSetup = useConnectorSetup();
	const disconnectConnector = useDisconnectRecipeConnector();
	const connectors = connectorsData?.connectors ?? [];
	const configuredProviderCount =
		providerSettings.filter((provider) => provider.hasApiKey).length +
		connectors.filter((connector) => connector.status === "connected").length;
	const totalProviderCount = providerSettings.length + connectors.length;
	const providerCounts = useMemo(
		() => ({
			all: providerSettings.length + connectors.length,
			connected: configuredProviderCount,
			chat: providerSettings.filter((provider) => provider.type === "chat").length,
			messaging: providerSettings.filter((provider) => provider.type === "messaging").length,
			connector: connectors.length,
		}),
		[configuredProviderCount, connectors.length, providerSettings],
	);
	const modalProvider = useMemo(
		() => providerSettings.find((provider) => provider.provider_id === modalState.providerId),
		[modalState.providerId, providerSettings],
	);

	useEffect(() => {
		completeConnectorAuthPopup(searchParams);
	}, [searchParams]);

	useEffect(() => {
		const requestedConnectorId = searchParams.get("connector");
		if (!requestedConnectorId || isLoadingConnectors) {
			return;
		}

		const connector = connectors.find((item) => item.id === requestedConnectorId);
		if (!connector) {
			return;
		}

		setSelectedConnector(connector);

		const nextSearchParams = new URLSearchParams(searchParams);
		nextSearchParams.delete("connector");
		nextSearchParams.set("type", "connector");
		setSearchParams(nextSearchParams, { replace: true });
	}, [connectors, isLoadingConnectors, searchParams, setSearchParams]);

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

	const handleProviderTypeChange = (value: string) => {
		const nextType = value as ProviderTypeFilter;
		const nextSearchParams = new URLSearchParams(searchParams);
		if (nextType === "all") nextSearchParams.delete("type");
		else nextSearchParams.set("type", nextType);
		setSearchParams(nextSearchParams, { replace: true });
	};

	const normalisedSearch = providerSearch.trim().toLowerCase();
	const catalogueItems: ProviderCatalogueItem[] = [
		...providerSettings.map((provider): ProviderCatalogueItem & { type: ProviderTypeFilter } => {
			const providerName = getProviderName(provider);
			const isConfigured = Boolean(provider.hasApiKey);
			return {
				id: `provider:${provider.provider_id}`,
				name: providerName,
				description: provider.webhookUrl ?? provider.description,
				category: provider.type === "messaging" ? "Messaging" : "AI models",
				connected: isConfigured,
				type: provider.type === "messaging" ? "messaging" : "chat",
				icon: (
					<ModelIcon
						modelName={providerName}
						provider={provider.provider_id}
						size={28}
						showFallback
						mono
					/>
				),
				onSelect: () => handleEnableProvider(provider.provider_id, providerName),
			};
		}),
		...connectors.map((connector): ProviderCatalogueItem & { type: ProviderTypeFilter } => ({
			id: `connector:${connector.id}`,
			name: connector.name,
			description:
				connectorSetup.connectingProviderId === connector.id
					? "Waiting for connection in the popup…"
					: connector.description,
			category: connector.categories?.[0]?.name ?? "Integrations",
			connected: connector.status === "connected",
			connecting: connectorSetup.connectingProviderId === connector.id,
			type: "connector",
			icon: <ConnectorLogo connector={connector} />,
			onSelect: () => setSelectedConnector(connector),
		})),
	].filter((item) => {
		if (providerType === "connected" && !item.connected) return false;
		if (!["all", "connected"].includes(providerType) && item.type !== providerType) return false;
		if (!normalisedSearch) return true;
		return `${item.name} ${item.description ?? ""} ${item.category}`
			.toLowerCase()
			.includes(normalisedSearch);
	});

	return (
		<div>
			<PageShell.Header
				title="Available Providers"
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
			/>

			<div className="space-y-5">
				{!isLoadingProviderSyncStatus && providerSyncRequired && (
					<Alert variant="warning" aria-label="Provider catalogue needs syncing">
						<AlertTitle>Provider catalogue needs syncing</AlertTitle>
						<AlertDescription>
							<p>
								New providers have not been synced to your account yet. Sync providers to make them
								available for configuration.
							</p>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => syncProviders()}
								disabled={isSyncingProviders}
							>
								{isSyncingProviders ? "Syncing providers…" : "Sync providers now"}
							</Button>
						</AlertDescription>
					</Alert>
				)}
				{!isLoadingProviderSettings && totalProviderCount > 0 && (
					<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<Tabs value={providerType} onValueChange={handleProviderTypeChange}>
							<TabsList className="max-w-full justify-start overflow-x-auto">
								<TabsTrigger value="all">All ({providerCounts.all})</TabsTrigger>
								<TabsTrigger value="connected">Connected ({providerCounts.connected})</TabsTrigger>
								<TabsTrigger value="chat">Chat ({providerCounts.chat})</TabsTrigger>
								<TabsTrigger value="messaging">Messaging ({providerCounts.messaging})</TabsTrigger>
								<TabsTrigger value="connector">
									Integrations ({providerCounts.connector})
								</TabsTrigger>
							</TabsList>
						</Tabs>
						<SearchInput
							aria-label="Search providers"
							placeholder="Search providers"
							value={providerSearch}
							onChange={setProviderSearch}
							className="w-full xl:max-w-xs"
						/>
					</div>
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
				) : catalogueItems.length === 0 ? (
					<EmptyState
						message={
							providerSearch ? "No providers match your search" : "No providers in this view"
						}
						className="bg-transparent dark:bg-transparent border-none py-10 px-0"
					/>
				) : (
					<ProviderCatalogue items={catalogueItems} />
				)}
			</div>

			<ProviderApiKeyModal
				open={modalState.open}
				onOpenChange={handleCloseModal}
				providerId={modalState.providerId}
				providerName={modalState.providerName}
				configurationFields={modalProvider?.configurationFields}
				configurationValues={modalProvider?.configurationValues}
				hasStoredCredentials={modalProvider?.hasApiKey}
				webhookUrl={modalProvider?.webhookUrl}
				onDelete={
					modalProvider?.hasApiKey
						? () => {
								setProviderToDelete({
									providerId: modalProvider.provider_id,
									providerName: getProviderName(modalProvider),
								});
								handleCloseModal(false);
							}
						: undefined
				}
				isDeleting={isDeletingProviderApiKey}
			/>
			<ConnectorSetupDialogs controller={connectorSetup} />
			<ConnectorDetailsModal
				connector={selectedConnector}
				onOpenChange={(open) => !open && setSelectedConnector(null)}
				onConnect={(connector) => {
					setSelectedConnector(null);
					void connectorSetup.connect(connector);
				}}
				onDisconnect={(connector) => {
					setSelectedConnector(null);
					setConnectorToDelete({ providerId: connector.id, providerName: connector.name });
				}}
				isStarting={connectorSetup.isStarting}
				isDisconnecting={disconnectConnector.isPending}
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
