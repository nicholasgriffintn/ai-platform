import { AppCard as ControlledAppCard } from "@ngriffin_uk/polychat-component-capabilities";
import type { CapabilityCatalogItem as AppListItem } from "@ngriffin_uk/polychat-schemas";

import { useChatStore } from "~/state/stores/chatStore";

interface AppCardProps {
	app: AppListItem;
	onSelect: () => void;
	isWrappedInGroup?: boolean;
}

export const AppCard = ({ app, onSelect, isWrappedInGroup = false }: AppCardProps) => {
	const { isAuthenticated, isPro } = useChatStore();

	return (
		<ControlledAppCard
			app={app}
			isAuthenticated={isAuthenticated}
			isPro={isPro}
			onSelect={onSelect}
			isWrappedInGroup={isWrappedInGroup}
		/>
	);
};
