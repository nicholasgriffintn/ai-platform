import { Link } from "react-router";

import { PageShell } from "~/components/Core/PageShell";
import { shouldShowDevTools } from "~/constants";

interface ErrorRouteProps {
	message: string;
	details: string;
	stack?: string;
}

export function meta() {
	return {
		title: "Error - Polychat",
		description: "An error occurred while loading the page",
	};
}

export default function ErrorRoute({
	message,
	details,
	stack,
}: ErrorRouteProps) {
	const shouldShowStack = Boolean(stack) && shouldShowDevTools();

	return (
		<PageShell className="flex h-dvh w-full max-w-full overflow-hidden bg-off-white dark:bg-zinc-900">
			<div className="flex-1 overflow-auto w-full space-y-3 p-4">
				<div className="text-base font-semibold text-zinc-600 dark:text-zinc-200 truncate">
					{message}
				</div>
				<div className="text-sm text-zinc-500 dark:text-zinc-400">
					{details}
				</div>
				{shouldShowStack ? (
					<div className="text-sm text-zinc-500 dark:text-zinc-400 break-words">
						{stack}
					</div>
				) : null}
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="rounded bg-primary px-3 py-2 text-sm text-white"
					>
						Retry
					</button>
					<Link
						to="/"
						className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
					>
						Go Home
					</Link>
				</div>
			</div>
		</PageShell>
	);
}
