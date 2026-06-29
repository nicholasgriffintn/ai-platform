import { useMemo } from "react";
import { ConversationThread } from "~/components/ConversationThread";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

interface HomeConversationThreadProps {
	urlModeConfig?: ConversationThreadModeConfig;
}

export function HomeConversationThread({ urlModeConfig }: HomeConversationThreadProps) {
	const { modeConfig } = useHomeChatModeConfig();
	const effectiveModeConfig = useMemo<ConversationThreadModeConfig>(() => {
		if (!urlModeConfig) {
			return modeConfig;
		}

		return {
			...modeConfig,
			requestOptions: {
				...modeConfig.requestOptions,
				...urlModeConfig.requestOptions,
				options: {
					...modeConfig.requestOptions?.options,
					...urlModeConfig.requestOptions?.options,
					recipe:
						urlModeConfig.requestOptions?.options?.recipe ??
						modeConfig.requestOptions?.options?.recipe,
				},
			},
			initialAutoSubmit: urlModeConfig.initialAutoSubmit ?? modeConfig.initialAutoSubmit,
		};
	}, [modeConfig, urlModeConfig]);

	return <ConversationThread modeConfig={effectiveModeConfig} />;
}
