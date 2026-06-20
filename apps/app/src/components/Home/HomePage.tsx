import { useEffect, useMemo, useState } from "react";

import { CanvasGenerationsView } from "~/components/Canvas/CanvasGenerationsView";
import { useCanvasStudio } from "~/components/Canvas/useCanvasStudio";
import { ChatSidebar } from "~/components/ChatSidebar";
import type { ConversationThreadModeConfig } from "~/components/ConversationThread";
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
import { HomeConversationThread } from "./HomeConversationThread";

export function HomePage() {
	const { initializeStore, showSearch, setShowSearch, setChatInput, startNewConversation } =
		useChatStore();
	const setSelectedTools = useToolsStore((state) => state.setSelectedTools);
	const [isCanvasMode, setIsCanvasMode] = useState(false);
	const [urlRequestOptions, setUrlRequestOptions] = useState<ChatRequestOptions | undefined>();
	const [urlState, setUrlState] = useState<ChatUrlState | null>(null);
	const canvas = useCanvasStudio({ enabled: isCanvasMode });

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

	const urlModeConfig = useMemo<ConversationThreadModeConfig | undefined>(() => {
		const initialAutoSubmit =
			urlState?.autoSubmit && urlState.query
				? {
						key: window.location.search,
						input: urlState.query,
					}
				: undefined;

		if (!urlRequestOptions && !initialAutoSubmit) {
			return undefined;
		}

		return {
			requestOptions: urlRequestOptions,
			initialAutoSubmit,
		};
	}, [urlRequestOptions, urlState]);

	return (
		<PageShell
			sidebarContent={
				<ChatSidebar
					canvas={canvas}
					isCanvasMode={isCanvasMode}
					onCanvasModeChange={setIsCanvasMode}
				/>
			}
			fullBleed={true}
			headerContent={<PageTitle title="Conversation" className="sr-only" />}
		>
			<div className="flex h-full min-h-0 flex-1 flex-row overflow-hidden">
				<div className="flex h-full min-h-0 w-full flex-1 flex-col">
					<div className="relative min-h-0 flex-1 overflow-hidden">
						{isCanvasMode ? (
							<CanvasGenerationsView canvas={canvas} />
						) : (
							<HomeConversationThread urlModeConfig={urlModeConfig} />
						)}
					</div>
				</div>
			</div>

			<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
		</PageShell>
	);
}
