import { Menu, PanelLeftOpen } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui";
import { APP_NAME } from "~/constants";
import { useUIStore } from "~/state/stores/uiStore";

interface ChatNavbarProps {
	showSidebarToggle?: boolean;
}

export const ChatNavbar = ({ showSidebarToggle = true }: ChatNavbarProps) => {
	const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore();

	return (
		<div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 z-10 w-full">
			<div className="m-2 flex items-center justify-between max-w-full">
				<div className="flex items-center min-w-0">
					{showSidebarToggle && (
						<div className="flex-shrink-0">
							<Button
								type="button"
								variant="icon"
								onClick={() => setSidebarVisible(!sidebarVisible)}
								title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
								aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
								icon={isMobile ? <Menu size={20} /> : <PanelLeftOpen size={20} />}
							/>
						</div>
					)}
					<span className="text-base font-semibold text-zinc-600 dark:text-zinc-200 ml-2 truncate">
						<Link to="/chat" className="hover:text-zinc-700 dark:hover:text-zinc-300 no-underline">
							{APP_NAME}
						</Link>
					</span>
				</div>
			</div>
		</div>
	);
};
