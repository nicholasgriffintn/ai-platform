import { CheckCircle, ChevronLeft, Clock } from "lucide-react";
import type { JSX } from "react";
import { Link, useParams } from "react-router";

import { PodcastView } from "~/components/Apps/Podcasts/View";
import { BackLink } from "~/components/Core/BackLink";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { ShareButton } from "~/components/ui/ShareButton";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button } from "~/components/ui";
import { useFetchPodcast } from "~/hooks/usePodcasts";
import { cn } from "~/lib/utils";

export function meta() {
	return [
		{ title: "Podcast Details - Polychat" },
		{ name: "description", content: "View podcast details" },
	];
}

export default function PodcastDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { data: podcast, isLoading, error } = useFetchPodcast(id || "");

	if (isLoading) {
		return (
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-4xl mx-auto"
			>
				<div className="flex justify-center items-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
				</div>
			</PageShell>
		);
	}

	if (error || !podcast) {
		return (
			<PageShell
				sidebarContent={<AppsSidebarContent />}
				className="max-w-4xl mx-auto"
			>
				<div className="flex flex-col justify-center items-center h-64 space-y-4">
					<p className="text-lg text-zinc-600 dark:text-zinc-400">
						Podcast not found
					</p>
					<Link to="/apps/podcasts">
						<Button variant="secondary">
							<ChevronLeft size={16} className="mr-1" />
							Back to Podcasts
						</Button>
					</Link>
				</div>
			</PageShell>
		);
	}

	const renderStatusIndicator = (status: string) => {
		const statusMap: Record<
			string,
			{ icon: JSX.Element; text: string; className: string }
		> = {
			complete: {
				icon: <CheckCircle size={16} />,
				text: "Complete",
				className:
					"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
			},
			processing: {
				icon: <Clock size={16} />,
				text: "Processing",
				className:
					"bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
			},
			transcribing: {
				icon: <Clock size={16} />,
				text: "Transcribing",
				className:
					"bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
			},
			summarizing: {
				icon: <Clock size={16} />,
				text: "Summarizing",
				className:
					"bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
			},
		};

		const statusInfo = statusMap[status] || statusMap.processing;

		return (
			<div
				className={cn(
					"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
					statusInfo.className,
				)}
			>
				{statusInfo.icon}
				<span>{statusInfo.text}</span>
			</div>
		);
	};

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<div className="flex justify-between items-center mb-6">
					<div>
						<BackLink to="/apps/podcasts" label="Back to Podcasts" />
						{podcast && (
							<PageTitle title={podcast.title || "Podcast Details"} />
						)}
						<div className="flex items-center gap-2 mt-2">
							{renderStatusIndicator(podcast.status)}
						</div>
					</div>
					{id && <ShareButton appId={id} />}
				</div>
			}
		>
			<PodcastView podcast={podcast} />
		</PageShell>
	);
}
