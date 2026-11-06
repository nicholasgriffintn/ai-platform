import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { ComposerBannerCard } from "../../Composer/ComposerBannerCard.js";
import { useComposerBanner } from "./useComposerBanner.js";

interface ComposerBannerProps {
  model?: ModelConfigItem;
  requestedModelId?: string | null;
  isModelsLoading?: boolean;
  hideSuggestions?: boolean;
  projectId?: string;
}

export function ComposerBanner({
  model,
  requestedModelId,
  isModelsLoading,
  hideSuggestions,
  projectId,
}: ComposerBannerProps) {
  const { banner, dismiss } = useComposerBanner({
    model,
    requestedModelId,
    isModelsLoading,
    hideSuggestions,
    projectId,
  });

  if (!banner) {
    return null;
  }

  return <ComposerBannerCard banner={banner} onDismiss={banner.dismissal ? dismiss : undefined} />;
}
