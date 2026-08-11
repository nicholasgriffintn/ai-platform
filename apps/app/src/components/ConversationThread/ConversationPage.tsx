import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { SearchDialog } from "~/components/Search/SearchDialog";
import {
	type AssistantActionLaunchState,
	loadAssistantActionRequestOptions,
	parseAssistantActionLaunchState,
} from "~/lib/assistant-action-launch";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import { mergeChatRequestOptions } from "~/lib/chat/request-options";
import type { ChatRequestOptions } from "~/types";
import { ConversationThread, type ConversationThreadModeConfig } from ".";
import { ConversationProductHeader } from "./ConversationProductHeader";

interface ConversationPageProps {
	embedded?: boolean;
	title: string;
	modeConfig?: ConversationThreadModeConfig;
	sidebarContent?: ReactNode;
}

export function ConversationPage({
	embedded = false,
	title,
	modeConfig,
	sidebarContent,
}: ConversationPageProps) {
	const {
		clearCurrentConversation,
		initializeStore,
		showSearch,
		setShowSearch,
		setChatInput,
		startNewConversation,
	} = useChatStore();
	const { setSelectedTools } = useToolsStore();
	const location = useLocation();
	const [urlRequestOptions, setUrlRequestOptions] = useState<ChatRequestOptions | undefined>();
	const [urlState, setUrlState] = useState<AssistantActionLaunchState | null>(null);

	useEffect(() => {
		const init = async () => {
			const searchParams = new URLSearchParams(location.search);
			const completionId = searchParams.get("completion_id");
			const nextUrlState = parseAssistantActionLaunchState(location.search);

			if (!completionId) {
				clearCurrentConversation();
			}
			await initializeStore(completionId || undefined);

			if (nextUrlState.autoSubmit) {
				startNewConversation();
				setChatInput("");
			} else if (nextUrlState.query) {
				setChatInput(nextUrlState.query);
			}
			if (nextUrlState.hasEnabledTools) {
				setSelectedTools(nextUrlState.enabledTools);
			}
			setUrlRequestOptions(loadAssistantActionRequestOptions(nextUrlState));
			setUrlState(nextUrlState);

			if (nextUrlState.autoSubmit) {
				searchParams.delete("auto_submit");
				const query = searchParams.toString();
				window.history.replaceState(
					{},
					"",
					`${window.location.pathname}${query ? `?${query}` : ""}`,
				);
			}
		};

		init();
	}, [
		clearCurrentConversation,
		initializeStore,
		location.search,
		setChatInput,
		setSelectedTools,
		startNewConversation,
	]);

	const effectiveModeConfig = useMemo<ConversationThreadModeConfig | undefined>(() => {
		if (!urlRequestOptions) {
			return modeConfig;
		}

		return {
			...modeConfig,
			requestOptions: mergeChatRequestOptions(modeConfig?.requestOptions, urlRequestOptions),
			initialAutoSubmit:
				urlState?.autoSubmit && urlState.query
					? {
							key: window.location.search,
							input: urlState.query,
						}
					: modeConfig?.initialAutoSubmit,
		};
	}, [modeConfig, urlRequestOptions, urlState]);

	const content = (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			{!embedded && <ConversationProductHeader />}
			<div className="relative flex min-h-0 flex-1 flex-grow flex-row overflow-hidden">
				<div className="flex min-h-0 w-full flex-grow flex-col">
					<div className="relative min-h-0 flex-1 overflow-hidden">
						<ConversationThread modeConfig={effectiveModeConfig} />
					</div>
				</div>
			</div>

			<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
		</div>
	);

	if (embedded) {
		return content;
	}

	return (
		<PageShell
			sidebarContent={sidebarContent ?? <ChatSidebar />}
			fullBleed={true}
			displayNavBar={false}
			headerContent={<PageTitle title={title} className="sr-only" />}
		>
			{content}
		</PageShell>
	);
}
