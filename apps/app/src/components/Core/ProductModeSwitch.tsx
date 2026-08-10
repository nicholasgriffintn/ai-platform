import { BriefcaseBusiness, MessageCircle } from "lucide-react";
import { NavLink, useLocation } from "react-router";

import { cn } from "~/lib/utils";

export function ProductModeSwitch({ className }: { className?: string }) {
	const { pathname } = useLocation();
	return (
		<div
			className={cn(
				"grid grid-cols-2 gap-1 rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800",
				className,
			)}
		>
			<NavLink
				to="/chat"
				className={({ isActive }) =>
					cn(
						"flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium no-underline transition-colors",
						isActive || pathname === "/"
							? "bg-off-white-highlight text-black shadow-sm dark:bg-[#2D2D2D] dark:text-white"
							: "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white",
					)
				}
			>
				<MessageCircle size={15} /> Chat
			</NavLink>
			<NavLink
				to="/work"
				className={({ isActive }) =>
					cn(
						"flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium no-underline transition-colors",
						isActive
							? "bg-off-white-highlight text-black shadow-sm dark:bg-[#2D2D2D] dark:text-white"
							: "text-zinc-600 hover:bg-zinc-100 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white",
					)
				}
			>
				<BriefcaseBusiness size={15} /> Work
			</NavLink>
		</div>
	);
}
