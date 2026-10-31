import { AppCard as ControlledAppCard } from "@ngriffin_uk/polychat-component-capabilities";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { CapabilityCatalogItem as AppListItem } from "@ngriffin_uk/polychat-schemas";
import { useShallow } from "zustand/react/shallow";

interface AppCardProps {
  app: AppListItem;
  onSelect: () => void;
  isWrappedInGroup?: boolean;
}

export const AppCard = ({ app, onSelect, isWrappedInGroup = false }: AppCardProps) => {
  const { isAuthenticated, isPro } = useChatStore(
    useShallow((state) => ({ isAuthenticated: state.isAuthenticated, isPro: state.isPro })),
  );

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
