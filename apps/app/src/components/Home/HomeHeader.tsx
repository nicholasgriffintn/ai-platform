import { Loader2, LogOut } from "lucide-react";

import { Logo } from "~/components/Core/Logo";
import { Button } from "~/components/ui";
import { APP_NAME } from "~/constants";
import { useAuthStatus } from "~/hooks/useAuth";

export function HomeHeader() {
	const { isAuthenticated, isLoggingOut, logout } = useAuthStatus();

	return (
		<header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-off-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
			<div className="flex min-w-0 items-center gap-2">
				<Logo variant="logo_control" className="h-8 w-8 shrink-0 [&>svg]:h-full [&>svg]:w-full" />
				<span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
					{APP_NAME}
				</span>
			</div>

			{isAuthenticated && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => logout()}
					disabled={isLoggingOut}
					icon={
						isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />
					}
				>
					Sign out
				</Button>
			)}
		</header>
	);
}
