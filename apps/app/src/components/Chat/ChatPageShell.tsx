import type { ReactNode } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";

export function ChatPageShell({
	children,
	isConversation,
}: {
	children: ReactNode;
	isConversation: boolean;
}) {
	if (isConversation) {
		return <>{children}</>;
	}

	return (
		<PageShell title="Chat" sidebarContent={<ChatSidebar />} fullBleed displayNavBar={false}>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				<div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
					{children}
				</div>
			</div>
		</PageShell>
	);
}
