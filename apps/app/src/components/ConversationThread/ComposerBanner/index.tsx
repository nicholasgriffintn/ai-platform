import { ComposerBannerCard } from "@ngriffin_uk/polychat-component-conversation";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { useComposerBanner } from "./useComposerBanner";

interface ComposerBannerProps {
  model?: ModelConfigItem;
  hideSuggestions?: boolean;
}

export function ComposerBanner({ model, hideSuggestions }: ComposerBannerProps) {
  const { banner, dismiss } = useComposerBanner({ model, hideSuggestions });

  if (!banner) {
    return null;
  }

  return <ComposerBannerCard banner={banner} onDismiss={banner.dismissal ? dismiss : undefined} />;
}
