import { PageShell } from "~/components/Core/PageShell";

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
}: {
	message: string;
	details: string;
	stack: string;
}) {
	return (
		<PageShell className="flex h-dvh w-full max-w-full overflow-hidden bg-off-white dark:bg-zinc-900">
			<div className="flex-1 overflow-auto w-full">
				<div className="text-base font-semibold text-zinc-600 dark:text-zinc-200 truncate">
					{message}
				</div>
				<div className="text-sm text-zinc-500 dark:text-zinc-400">
					{details}
				</div>
				<div className="text-sm text-zinc-500 dark:text-zinc-400">{stack}</div>
			</div>
		</PageShell>
	);
}
