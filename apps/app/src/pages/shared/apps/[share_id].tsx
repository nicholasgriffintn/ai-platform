import { FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import {
	AppContentRenderer,
	type AppDataItem,
} from "~/components/Apps/ContentRenderers";
import { PageShell } from "~/components/Core/PageShell";
import { PageStatus } from "~/components/Core/PageStatus";
import { getSharedItem } from "~/hooks/useAppsSharing";

export function meta({ params }: { params: { share_id: string } }) {
	return [
		{ title: `Shared Content ${params.share_id} - Polychat` },
		{ name: "description", content: "Shared content from Polychat" },
	];
}

const SharedHeader = () => (
	<header className="sticky top-0 z-10 border-b border-zinc-200 bg-off-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
		<div className="mx-auto flex max-w-3xl items-center justify-between">
			<div className="flex items-center">
				<FileQuestion
					size={20}
					className="mr-2 text-zinc-600 dark:text-zinc-400"
				/>
				<h1 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
					Shared Content
				</h1>
			</div>
			<div className="flex items-center gap-2">
				<Link
					to="/"
					className="no-underline inline-flex items-center gap-1 rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
				>
					<span>Go to Polychat</span>
				</Link>
			</div>
		</div>
	</header>
);

export default function SharedItemPage() {
	const { share_id } = useParams<{ share_id: string }>();
	const [sharedItem, setSharedItem] = useState<AppDataItem | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchSharedItem = async () => {
			if (!share_id) {
				setError("Invalid share link");
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				const item = await getSharedItem({ share_id });
				setSharedItem(item);
				setIsLoading(false);
			} catch (err) {
				console.error("Error fetching shared item:", err);
				setError(
					err instanceof Error
						? err.message
						: "An error occurred while loading the shared content.",
				);
				setIsLoading(false);
			}
		};

		fetchSharedItem();
	}, [share_id]);

	if (isLoading) {
		return (
			<PageShell
				className="flex h-screen w-full items-center justify-center bg-off-white dark:bg-zinc-900"
				displayNavBar={false}
			>
				<div className="flex flex-col items-center">
					<Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
					<p className="text-zinc-600 dark:text-zinc-400">
						Loading shared content...
					</p>
				</div>
			</PageShell>
		);
	}

	if (error) {
		return (
			<PageShell
				title="Shared Content Not Available"
				className="bg-off-white dark:bg-zinc-900"
				displayNavBar={false}
			>
				<PageStatus message={error}>
					<Link
						to="/"
						className="inline-flex items-center rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
					>
						Return Home
					</Link>
				</PageStatus>
			</PageShell>
		);
	}

	if (!sharedItem) {
		return (
			<PageShell
				title="Shared Content Not Available"
				className="bg-off-white dark:bg-zinc-900"
				displayNavBar={false}
			>
				<PageStatus message="This shared content was not found or is no longer available.">
					<Link
						to="/"
						className="inline-flex items-center rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2"
					>
						Return Home
					</Link>
				</PageStatus>
			</PageShell>
		);
	}

	return (
		<PageShell
			title={`Shared ${sharedItem.app_id} Content`}
			headerContent={<SharedHeader />}
			displayNavBar={false}
			fullBleed={true}
			className="flex min-h-screen flex-col bg-off-white dark:bg-zinc-900"
		>
			<div className="pt-4 pb-4 flex flex-col h-[calc(100vh)] w-full">
				<div className="relative flex-1 overflow-x-hidden overflow-y-scroll">
					<div className="h-full mx-auto flex w-full max-w-3xl grow flex-col gap-8 px-4">
						<AppContentRenderer item={sharedItem} />
					</div>
				</div>
			</div>
		</PageShell>
	);
}
