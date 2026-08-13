import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Button } from "@ngriffin_uk/polychat-component-ui";
import { APP_NAME } from "~/constants";
import { useUIStore } from "~/state/stores/uiStore";

interface SidebarHeaderProps {
	actions?: ReactNode;
}

export function SidebarHeader({ actions }: SidebarHeaderProps) {
	const { sidebarVisible, setSidebarVisible } = useUIStore();

	return (
		<div className="sticky top-0 z-10 h-[53px] w-full bg-off-white dark:bg-zinc-900">
			<div className="flex h-full items-center justify-between px-2">
				<Link
					to="/chat"
					className="px-1 text-sm font-semibold text-zinc-700 no-underline hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
				>
					{APP_NAME}
				</Link>
				<div className="flex items-center gap-1">
					{actions}
					<Button
						type="button"
						variant="icon"
						title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
						aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
						icon={sidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
						onClick={() => setSidebarVisible(!sidebarVisible)}
					/>
				</div>
			</div>
		</div>
	);
}
