import { Home } from "lucide-react";
import { Link } from "react-router";

import { SidebarShell } from "~/components/ui/SidebarShell";
import { cn } from "~/lib/utils";
import { useUIStore } from "~/state/stores/uiStore";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";

export function StandardSidebarContent() {
	const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();

	return (
		<SidebarShell
			visible={sidebarVisible}
			isMobile={isMobile}
			onClose={() => setSidebarVisible(false)}
			header={<SidebarHeader showCloudButton={false} />}
			footer={<SidebarFooter />}
		>
			<nav className="p-2 pb-[50px]">
				<ul className="space-y-1">
					<li>
						<Link
							to="/"
							className={cn(
								"block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out",
								"text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
								"dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
								"no-underline",
								"flex items-center",
							)}
						>
							<Home className="mr-2 h-5 w-5 flex-shrink-0" />
							<span>Back to Home</span>
						</Link>
					</li>
				</ul>
			</nav>
		</SidebarShell>
	);
}
