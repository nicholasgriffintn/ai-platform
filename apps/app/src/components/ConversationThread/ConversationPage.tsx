import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { type ReactNode } from "react";

import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { ConversationThread, type ConversationThreadModeConfig } from ".";
import { ConversationProductHeader } from "./ConversationProductHeader";
import { useConversationLaunchModeConfig } from "./useConversationLaunchModeConfig";

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
	const effectiveModeConfig = useConversationLaunchModeConfig(modeConfig);

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
