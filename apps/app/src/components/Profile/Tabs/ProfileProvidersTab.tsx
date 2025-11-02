import { Plus, Power, RefreshCcw } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { HoverActions, ListItem } from "~/components/ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useUser } from "~/hooks/useUser";
import { ProviderApiKeyModal } from "../Modals/ProviderApiKeyModal";

interface ProviderSetting {
	id: string;
	provider_id: string;
	name?: string;
	description?: string;
	enabled: boolean;
}

interface ProviderModalState {
	open: boolean;
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
	} = useUser();
	const [modalState, setModalState] = useState<ProviderModalState>({
		open: false,
		providerId: "",
		providerName: "",
	});

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
				) : !providerSettings || Object.keys(providerSettings).length === 0 ? (
					<EmptyState
						message="No providers available"
						className="bg-transparent dark:bg-transparent border-none py-10 px-0"
					/>
				) : (
					<ul className="space-y-2">
						{Object.entries(providerSettings).map(([providerId, provider]) => (
							<ListItem
								key={providerId}
								className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750"
								label={
									(provider as ProviderSetting).name ||
									(provider as ProviderSetting).provider_id
								}
								sublabel={(provider as ProviderSetting).description}
								badge={
									(provider as ProviderSetting).enabled ? (
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
												icon: (provider as ProviderSetting).enabled ? (
													<Power size={14} />
												) : (
													<Plus size={14} />
												),
												label: (provider as ProviderSetting).enabled
													? "Configure"
													: "Enable",
												onClick: (e) => {
													e.stopPropagation();
													handleEnableProvider(
														(provider as ProviderSetting).id,
														(provider as ProviderSetting).name ||
															(provider as ProviderSetting).provider_id,
													);
												},
											},
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
		</div>
	);
}
