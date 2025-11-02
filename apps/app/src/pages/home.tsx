import { useEffect } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { ConversationThread } from "~/components/ConversationThread";
import { PageShell } from "~/components/Core/PageShell";
import { SearchDialog } from "~/components/Search/SearchDialog";
import { useChatStore } from "~/state/stores/chatStore";
import { PageTitle } from "../components/Core/PageTitle";

export function meta() {
	return [
		{ title: "Polychat" },
		{
			name: "description",
			content: "Chat with multiple AI models from one place",
		},
	];
}

export default function Home() {
	const { initializeStore, showSearch, setShowSearch, setChatInput } =
		useChatStore();

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
	}, []);

	const chatSidebar = <ChatSidebar />;

	return (
		<PageShell
			sidebarContent={chatSidebar}
			fullBleed={true}
			headerContent={<PageTitle title="Conversation" className="sr-only" />}
		>
			<div className="flex flex-row flex-grow flex-1 overflow-hidden relative h-full">
				<div className="flex flex-col flex-grow h-full w-full">
					<div className="flex-1 overflow-hidden relative">
						<ConversationThread />
					</div>
				</div>
			</div>

			<SearchDialog isOpen={showSearch} onClose={() => setShowSearch(false)} />
		</PageShell>
	);
}
