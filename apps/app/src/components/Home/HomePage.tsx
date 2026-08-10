import { useEffect, useState } from "react";

import { CanvasGenerationsView } from "~/components/Canvas/CanvasGenerationsView";
import { useCanvasStudio } from "~/components/Canvas/useCanvasStudio";
import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import { SearchDialog } from "~/components/Search/SearchDialog";
import { useChatStore } from "~/state/stores/chatStore";
import { HomeConversationThread } from "./HomeConversationThread";

export function HomePage() {
	const { clearCurrentConversation, initializeStore, showSearch, setShowSearch } = useChatStore();
	const [isCanvasMode, setIsCanvasMode] = useState(false);
	const canvas = useCanvasStudio({ enabled: isCanvasMode });

	useEffect(() => {
		const init = async () => {
			const completionId = new URLSearchParams(window.location.search).get("completion_id");
			if (!completionId) {
				clearCurrentConversation();
			}
			await initializeStore(completionId || undefined);
		};

		init();
	}, [clearCurrentConversation, initializeStore]);

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
			displayNavBar={false}
			headerContent={<PageTitle title="Conversation" className="sr-only" />}
		>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				<ProductModeHeader showCloudToggle />
				<div className="flex min-h-0 flex-1 flex-row overflow-hidden">
					<div className="flex min-h-0 w-full flex-1 flex-col">
						<div className="relative min-h-0 flex-1 overflow-hidden">
							{isCanvasMode ? (
								<CanvasGenerationsView canvas={canvas} />
							) : (
								<HomeConversationThread />
							)}
						</div>
					</div>
				</div>

				<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
			</div>
		</PageShell>
	);
}
