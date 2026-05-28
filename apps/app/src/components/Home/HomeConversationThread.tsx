import { ConversationThread } from "~/components/ConversationThread";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

export function HomeConversationThread() {
	const { modeConfig } = useHomeChatModeConfig();

	return <ConversationThread modeConfig={modeConfig} />;
}
