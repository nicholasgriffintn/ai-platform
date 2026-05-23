import { Loader2, Plus, Power, RefreshCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { ConfirmationDialog, HoverActions, ListItem } from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useUser } from "~/hooks/useUser";
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

export function ProfileProvidersTab() {
	const { trackEvent } = useTrackEvent();

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
				{isLoadingProviderSettings ? (
					<div className="flex justify-center py-10">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
					</div>
				) : providerSettings.length === 0 ? (
					<EmptyState
						message="No providers available"
						className="bg-transparent dark:bg-transparent border-none py-10 px-0"
					/>
				) : (
					<ul className="space-y-2">
						{providerSettings.map((provider: ProviderSetting) => (
							<ListItem
								key={provider.id}
								className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750"
								label={provider.name || provider.provider_id}
								sublabel={provider.description}
								badge={
									provider.enabled ? (
										<span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">
											<Power className="h-3 w-3 mr-1" /> Enabled
										</span>
									) : undefined
								}
								actions={
									<HoverActions
										alwaysVisible
										actions={[
											{
												id: "configure",
												icon: provider.enabled ? <Power size={14} /> : <Plus size={14} />,
												label: provider.enabled ? "Configure" : "Enable",
												onClick: (e) => {
													e.stopPropagation();
													handleEnableProvider(
														provider.provider_id,
														provider.name || provider.provider_id,
													);
												},
											},
											...(provider.enabled
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
															label: `Delete provider ${provider.name || provider.provider_id}`,
															onClick: (e: React.MouseEvent) => {
																e.stopPropagation();
																setProviderToDelete({
																	providerId: provider.provider_id,
																	providerName: provider.name || provider.provider_id,
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
						))}
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
		</div>
	);
}
