import { useCanvasStudio } from "~/components/Canvas/useCanvasStudio";
import { PageTitle } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { CanvasGenerationsView } from "@ngriffin_uk/polychat-component-experiences/media";
import { ChatSidebar } from "~/components/ChatSidebar";
import { PageShell } from "~/components/Core/PageShell";
import { ProductModeHeader } from "~/components/Core/ProductModeHeader";
import { ConversationProductHeader } from "~/components/ConversationThread/ConversationProductHeader";
import { HomeConversationThread } from "./HomeConversationThread";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

export function HomePage() {
	const [isCanvasMode, setIsCanvasMode] = useState(false);
	const { modeConfig } = useHomeChatModeConfig();
	const canvas = useCanvasStudio({ enabled: isCanvasMode });

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
				{isCanvasMode ? (
					<ProductModeHeader showCloudToggle />
				) : (
					<ConversationProductHeader showCloudToggle />
				)}
				<div className="flex min-h-0 flex-1 flex-row overflow-hidden">
					<div className="flex min-h-0 w-full flex-1 flex-col">
						<div className="relative min-h-0 flex-1 overflow-hidden">
							{isCanvasMode ? (
								<CanvasGenerationsView canvas={canvas} />
							) : (
								<HomeConversationThread urlModeConfig={modeConfig} />
							)}
						</div>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
