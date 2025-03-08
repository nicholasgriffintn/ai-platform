import { useEffect } from "react";

import { ChatNavbar } from "./ChatNavbar";
import { ChatSidebar } from "./ChatSidebar";
import { useChatStore } from "../stores/chatStore";

interface AppLayoutProps {
	children: React.ReactNode;
	onEnterApiKey?: () => void;
	isChat?: boolean;
}

export default function AppLayout({
	children,
	onEnterApiKey = () => {},
	isChat = false,
}: AppLayoutProps) {
	const { sidebarVisible, setSidebarVisible, setIsMobile } = useChatStore();

	useEffect(() => {
		const checkMobile = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      setIsMobile(isMobile);
			setSidebarVisible(!isMobile);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, [setSidebarVisible]);

	return (
		<div className="flex h-dvh w-screen overflow-clip bg-white dark:bg-zinc-900">
			<div className="flex flex-row flex-grow flex-1 overflow-hidden relative">
				{isChat && <ChatSidebar />}
				<div className="flex flex-col flex-grow h-full w-full">
					<ChatNavbar
						onEnterApiKey={onEnterApiKey}
						showSidebarToggle={isChat && !sidebarVisible}
					/>
					<div className="flex-1 overflow-auto">{children}</div>
				</div>
			</div>
		</div>
	);
}
