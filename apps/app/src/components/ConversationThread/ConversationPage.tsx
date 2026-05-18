import { useEffect } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { SearchDialog } from "~/components/Search/SearchDialog";
import { useChatStore } from "~/state/stores/chatStore";
import { ConversationThread, type ConversationThreadModeConfig } from ".";

interface ConversationPageProps {
	title: string;
	modeConfig?: ConversationThreadModeConfig;
}

export function ConversationPage({ title, modeConfig }: ConversationPageProps) {
	const { initializeStore, showSearch, setShowSearch, setChatInput } = useChatStore();

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
			sidebarContent={<ChatSidebar />}
			fullBleed={true}
			headerContent={<PageTitle title={title} className="sr-only" />}
		>
			<div className="flex flex-row flex-grow flex-1 overflow-hidden relative h-full">
				<div className="flex flex-col flex-grow h-full w-full">
					<div className="flex-1 overflow-hidden relative">
						<ConversationThread modeConfig={modeConfig} />
					</div>
				</div>
			</div>

			<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
		</PageShell>
	);
}
