import { useEffect, useMemo, useState } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { SearchDialog } from "~/components/Search/SearchDialog";
import {
	type ChatUrlState,
	loadRecipeChatRequestOptions,
	parseChatUrlState,
} from "~/lib/recipe-chat-context";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatRequestOptions } from "~/types";
import { ConversationThread, type ConversationThreadModeConfig } from ".";

interface ConversationPageProps {
	title: string;
	modeConfig?: ConversationThreadModeConfig;
}

export function ConversationPage({ title, modeConfig }: ConversationPageProps) {
	const { initializeStore, showSearch, setShowSearch, setChatInput, startNewConversation } =
		useChatStore();
	const { setSelectedTools } = useToolsStore();
	const [urlRequestOptions, setUrlRequestOptions] = useState<ChatRequestOptions | undefined>();
	const [urlState, setUrlState] = useState<ChatUrlState | null>(null);

	useEffect(() => {
		const init = async () => {
			const searchParams = new URLSearchParams(window.location.search);
			const completionId = searchParams.get("completion_id");
			const nextUrlState = parseChatUrlState(window.location.search);

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
			setUrlRequestOptions(loadRecipeChatRequestOptions(nextUrlState.recipeContext));
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
	}, [initializeStore, setChatInput, setSelectedTools, startNewConversation]);

	const effectiveModeConfig = useMemo<ConversationThreadModeConfig | undefined>(() => {
		if (!urlRequestOptions) {
			return modeConfig;
		}

		return {
			...modeConfig,
			requestOptions: {
				...modeConfig?.requestOptions,
				...urlRequestOptions,
				recipe: urlRequestOptions.recipe ?? modeConfig?.requestOptions?.recipe,
			},
			initialAutoSubmit:
				urlState?.autoSubmit && urlState.query
					? {
							key: window.location.search,
							input: urlState.query,
						}
					: modeConfig?.initialAutoSubmit,
		};
	}, [modeConfig, urlRequestOptions, urlState]);

	return (
		<PageShell
			sidebarContent={<ChatSidebar />}
			fullBleed={true}
			headerContent={<PageTitle title={title} className="sr-only" />}
		>
			<div className="relative flex h-full min-h-0 flex-1 flex-grow flex-row overflow-hidden">
				<div className="flex h-full min-h-0 w-full flex-grow flex-col">
					<div className="relative min-h-0 flex-1 overflow-hidden">
						<ConversationThread modeConfig={effectiveModeConfig} />
					</div>
				</div>
			</div>

			<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
		</PageShell>
	);
}
