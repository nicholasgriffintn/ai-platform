import { useEffect, useState } from "react";

import { CanvasGenerationsView } from "~/components/Canvas/CanvasGenerationsView";
import { useCanvasStudio } from "~/components/Canvas/useCanvasStudio";
import { ChatSidebar } from "~/components/ChatSidebar";
import { ConversationThread } from "~/components/ConversationThread";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { SearchDialog } from "~/components/Search/SearchDialog";
import { useChatStore } from "~/state/stores/chatStore";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

export function HomePage() {
	const { initializeStore, showSearch, setShowSearch, setChatInput } = useChatStore();
	const [isCanvasMode, setIsCanvasMode] = useState(false);
	const canvas = useCanvasStudio({ enabled: isCanvasMode });
	const { modeConfig } = useHomeChatModeConfig();

	useEffect(() => {
		const init = async () => {
			const searchParams = new URLSearchParams(window.location.search);
			const completionId = searchParams.get("completion_id");
			const query = searchParams.get("query");

			if (query) {
				setChatInput(query);
			}

			await initializeStore(completionId || undefined);
		};

		init();
	}, [initializeStore, setChatInput]);

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
							<ConversationThread modeConfig={modeConfig} />
						)}
					</div>
				</div>
			</div>

			<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
		</PageShell>
	);
}
