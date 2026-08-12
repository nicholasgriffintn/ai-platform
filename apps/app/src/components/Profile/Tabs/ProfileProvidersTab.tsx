import { RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { recipeConnectorProviderSchema } from "@assistant/schemas";
import type { RecipeConnectorManifest, RecipeConnectorProvider } from "@assistant/schemas";

import { EmptyState } from "~/components/Core/EmptyState";
import { ModelIcon } from "~/components/ModelIcon";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { ConfirmationDialog, SearchInput } from "~/components/ui";
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
import { ApiError } from "~/lib/api/fetch-wrapper";
import type { ProviderSetting } from "~/lib/api/services/user-service";
import {
	completeConnectorAuthPopup,
	navigateConnectorAuthPopup,
	openConnectorAuthPopup,
	waitForConnectorAuthPopup,
} from "~/lib/connector-auth-popup";
import { ConnectorDetailsModal } from "../Connectors/ConnectorDetailsModal";
import { ConnectorLogo } from "../Connectors/ConnectorLogo";
import { ConnectorApiKeyModal } from "../Modals/ConnectorApiKeyModal";
import { ConnectorAuthConfigModal } from "../Modals/ConnectorAuthConfigModal";
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

interface ConnectorApiKeyModalState {
	open: boolean;
	providerId: RecipeConnectorProvider | null;
	providerName: string;
	credentialLabel?: string;
}

interface ConnectorAuthConfigModalState {
	providerId: RecipeConnectorProvider | null;
	providerName: string;
	configs: NonNullable<RecipeConnectorManifest["authConfigs"]>;
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
	const [connectorApiKeyModal, setConnectorApiKeyModal] = useState<ConnectorApiKeyModalState>({
		open: false,
		providerId: null,
		providerName: "",
	});
	const [connectorAuthConfigModal, setConnectorAuthConfigModal] =
		useState<ConnectorAuthConfigModalState>({
			providerId: null,
			providerName: "",
			configs: [],
		});
	const [connectingProviderId, setConnectingProviderId] = useState<RecipeConnectorProvider | null>(
		null,
	);
	const connectorPopupRef = useRef<Window | null>(null);
	const connectorPopupAbortRef = useRef<AbortController | null>(null);
	const isMountedRef = useRef(true);
	const providerType = readProviderTypeFilter(searchParams.get("type"));
	const [providerSearch, setProviderSearch] = useState("");
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
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			connectorPopupAbortRef.current?.abort();
			if (connectorPopupRef.current && !connectorPopupRef.current.closed) {
				connectorPopupRef.current.close();
			}
		};
	}, []);

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

	const startComposioConnector = async (
		connector: RecipeConnectorManifest,
		authConfigId?: string,
	) => {
		if (connectorPopupRef.current && !connectorPopupRef.current.closed) {
			connectorPopupRef.current.focus();
			toast.info("Finish the current connector setup before starting another.");
			return;
		}

		const popup = openConnectorAuthPopup();
		if (!popup) {
			toast.error("Allow popups for Polychat to connect this provider.");
			return;
		}
		const abortController = new AbortController();
		connectorPopupRef.current = popup;
		connectorPopupAbortRef.current = abortController;
		setConnectingProviderId(connector.id);
		const toastId = toast.loading(`Waiting for ${connector.name}`, {
			description: "Complete the connection in the popup window.",
		});

		try {
			const completion = waitForConnectorAuthPopup({
				popup,
				provider: connector.id,
				signal: abortController.signal,
			});
			const response = await startConnector.mutateAsync({
				provider: connector.id,
				authConfigId,
				returnTo: "/profile?tab=providers&type=connector",
			});
			if (!popup.closed) navigateConnectorAuthPopup(popup, response.authorizationUrl);
			const outcome = await completion;
			if (outcome === "aborted") {
				toast.dismiss(toastId);
				return;
			}
			if (outcome === "connected") {
				await queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY });
				toast.success(`${connector.name} connected`, { id: toastId });
				return;
			}
			toast.error(
				outcome === "timed_out"
					? `${connector.name} connection timed out.`
					: `${connector.name} connection window was closed.`,
				{ id: toastId },
			);
		} catch (error) {
			abortController.abort();
			if (!popup.closed) popup.close();
			console.error(error);
			toast.error(error instanceof ApiError ? error.message : "Could not start connector setup.", {
				id: toastId,
			});
		} finally {
			if (connectorPopupRef.current === popup) connectorPopupRef.current = null;
			if (connectorPopupAbortRef.current === abortController) {
				connectorPopupAbortRef.current = null;
			}
			if (isMountedRef.current) setConnectingProviderId(null);
		}
	};

	const handleConnectConnector = async (connector: RecipeConnectorManifest) => {
		if (connector.authType === "api_key") {
			setConnectorApiKeyModal({
				open: true,
				providerId: connector.id,
				providerName: connector.name,
				credentialLabel: connector.credentialLabel,
			});
			return;
		}
		const authConfigs = connector.authConfigs ?? [];
		if (authConfigs.length > 1) {
			setConnectorAuthConfigModal({
				providerId: connector.id,
				providerName: connector.name,
				configs: authConfigs,
			});
			return;
		}
		await startComposioConnector(connector, authConfigs[0]?.id);
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

	const handleCloseConnectorApiKeyModal = (open: boolean) => {
		setConnectorApiKeyModal({
			open,
			providerId: open ? connectorApiKeyModal.providerId : null,
			providerName: open ? connectorApiKeyModal.providerName : "",
			credentialLabel: open ? connectorApiKeyModal.credentialLabel : undefined,
		});
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
				connectingProviderId === connector.id
					? "Waiting for connection in the popup…"
					: connector.description,
			category: connector.categories?.[0]?.name ?? "Integrations",
			connected: connector.status === "connected",
			connecting: connectingProviderId === connector.id,
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

			<div className="space-y-5">
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
			<ConnectorApiKeyModal
				open={connectorApiKeyModal.open}
				onOpenChange={handleCloseConnectorApiKeyModal}
				providerId={connectorApiKeyModal.providerId}
				providerName={connectorApiKeyModal.providerName}
				credentialLabel={connectorApiKeyModal.credentialLabel}
				onStored={() => queryClient.invalidateQueries({ queryKey: RECIPE_CONNECTORS_QUERY_KEY })}
			/>
			<ConnectorAuthConfigModal
				configs={connectorAuthConfigModal.configs}
				providerName={connectorAuthConfigModal.providerName}
				isLoading={startConnector.isPending}
				onOpenChange={(open) => {
					if (!open) {
						setConnectorAuthConfigModal({ providerId: null, providerName: "", configs: [] });
					}
				}}
				onSelect={(authConfigId) => {
					const connector = connectors.find(
						(item) => item.id === connectorAuthConfigModal.providerId,
					);
					if (connector) {
						setConnectorAuthConfigModal({ providerId: null, providerName: "", configs: [] });
						void startComposioConnector(connector, authConfigId);
					}
				}}
			/>
			<ConnectorDetailsModal
				connector={selectedConnector}
				onOpenChange={(open) => !open && setSelectedConnector(null)}
				onConnect={(connector) => {
					setSelectedConnector(null);
					void handleConnectConnector(connector);
				}}
				onDisconnect={(connector) => {
					setSelectedConnector(null);
					setConnectorToDelete({ providerId: connector.id, providerName: connector.name });
				}}
				isStarting={startConnector.isPending}
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
