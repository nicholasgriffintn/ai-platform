import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { ComposerBannerCard } from "./ComposerBannerCard";
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
