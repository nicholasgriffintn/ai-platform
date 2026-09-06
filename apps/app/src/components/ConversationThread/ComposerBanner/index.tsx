import { ComposerBannerCard } from "@ngriffin_uk/polychat-component-conversation";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { useComposerBanner } from "./useComposerBanner";

interface ComposerBannerProps {
  model?: ModelConfigItem;
  requestedModelId?: string | null;
  isModelsLoading?: boolean;
  hideSuggestions?: boolean;
}

export function ComposerBanner({
  model,
  requestedModelId,
  isModelsLoading,
  hideSuggestions,
}: ComposerBannerProps) {
  const { banner, dismiss } = useComposerBanner({
    model,
    requestedModelId,
    isModelsLoading,
    hideSuggestions,
  });

  if (!banner) {
    return null;
  }

  return <ComposerBannerCard banner={banner} onDismiss={banner.dismissal ? dismiss : undefined} />;
}
