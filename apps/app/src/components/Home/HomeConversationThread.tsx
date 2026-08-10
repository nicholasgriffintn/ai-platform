import { ConversationThread } from "~/components/ConversationThread";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";

interface HomeConversationThreadProps {
	urlModeConfig?: ConversationThreadModeConfig;
}

export function HomeConversationThread({ urlModeConfig }: HomeConversationThreadProps) {
	return (
		<ConversationThread
			modeConfig={{
				...urlModeConfig,
				hideComposerActionMenu: true,
				modeControls: { includeSettingCommands: false },
				welcomeTitle: "How can I help?",
				welcomeDescription: "A clean conversation, separate from your shared project work.",
			}}
		/>
	);
}
