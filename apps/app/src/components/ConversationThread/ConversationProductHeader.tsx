import { GitBranch } from "lucide-react";
import { useMemo } from "react";

import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import { Button } from "~/components/ui";
import { useChat } from "~/hooks/useChat";
import { buildAgentTraceEntries } from "~/lib/agent-trace";
import { useChatStore } from "~/state/stores/chatStore";
import { AgentTraceButton } from "./AgentTracePanel";
import { ShareButton } from "./ShareButton";

interface ConversationProductHeaderProps {
	showCloudToggle?: boolean;
}

export function ConversationProductHeader({
	showCloudToggle = false,
}: ConversationProductHeaderProps) {
	const { currentConversationId, isAuthenticated, setCurrentConversationId } = useChatStore();
	const { data: conversation, isLoading } = useChat(currentConversationId);
	const traceEntries = useMemo(
		() => buildAgentTraceEntries(conversation?.messages ?? []),
		[conversation?.messages],
	);
	const title =
		currentConversationId && isLoading
			? "Loading conversation…"
			: (conversation?.title ?? "New conversation");

	return (
		<ProductModeHeader
			showCloudToggle={showCloudToggle}
			context={
				<div className="flex min-w-0 items-center gap-1 text-sm sm:gap-1.5">
					{conversation?.parent_conversation_id ? (
						<Button
							variant="icon"
							className="h-8 w-8 shrink-0 p-1.5"
							title="Go to original conversation"
							aria-label="Go to original conversation"
							icon={<GitBranch className="h-3.5 w-3.5" />}
							onClick={() => setCurrentConversationId(conversation.parent_conversation_id!)}
						/>
					) : null}
					<span className="truncate font-medium text-zinc-800 dark:text-zinc-200" title={title}>
						{title}
					</span>
				</div>
			}
			actions={
				<div className="flex shrink-0 items-center gap-0.5">
					<AgentTraceButton entries={traceEntries} compactOnMobile />
					{!conversation?.isLocalOnly &&
						!conversation?.project_id &&
						!isLoading &&
						currentConversationId &&
						isAuthenticated && (
							<ShareButton
								conversationId={currentConversationId}
								isPublic={conversation?.is_public}
								shareId={conversation?.share_id}
								className="shrink-0"
								compactOnMobile
							/>
						)}
				</div>
			}
		/>
	);
}
