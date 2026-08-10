import { Mic2, Plus } from "lucide-react";
import { Link } from "react-router";
import type { Podcast } from "@assistant/schemas";

import { PodcastView } from "~/components/Apps/Podcasts/View";
import { PodcastWorkflow } from "~/components/Apps/Podcasts/PodcastWorkflow";
import { EmptyState } from "~/components/Core/EmptyState";
import { Button, Card } from "~/components/ui";
import { useFetchPodcast, useFetchPodcasts, useProcessPodcast } from "~/hooks/usePodcasts";
import { WorkCardGridSkeleton } from "../WorkLoadingSkeletons";

export function PodcastsExperience({ basePath, projectId, subpath }: ExperienceProps) {
	const segments = subpath.split("/").filter(Boolean);
	const podcastId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
	const isNew = segments[0] === "new";
	const { data: podcasts, isLoading, error } = useFetchPodcasts(projectId);
	const {
		data: podcast,
		isLoading: isPodcastLoading,
		error: podcastError,
	} = useFetchPodcast(podcastId ?? "", projectId);

	if (isNew) return <PodcastWorkflow basePath={basePath} projectId={projectId} />;
	if (podcastId) {
		if (isPodcastLoading) return <WorkCardGridSkeleton count={1} label="Loading podcast" />;
		if (podcastError || !podcast)
			return (
				<EmptyState
					title="Podcast unavailable"
					message={podcastError?.message ?? "Podcast not found"}
				/>
			);
		return <PodcastDetail podcast={podcast} projectId={projectId} />;
	}
	if (isLoading) return <WorkCardGridSkeleton count={4} label="Loading podcasts" />;
	if (error) return <EmptyState title="Podcasts unavailable" message={error.message} />;
	if (!podcasts?.length) {
		return (
			<EmptyState
				icon={<Mic2 size={24} className="text-zinc-400" />}
				title="No project podcasts"
				message="Upload a recording or audio URL to begin processing it."
				action={
					<Link to={`${basePath}/new`}>
						<Button variant="primary" icon={<Plus size={16} />}>
							New podcast
						</Button>
					</Link>
				}
			/>
		);
	}

	return (
		<div>
			<div className="mb-5 flex justify-end">
				<Link to={`${basePath}/new`}>
					<Button variant="primary" icon={<Plus size={16} />}>
						New podcast
					</Button>
				</Link>
			</div>
			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{podcasts.map((item) => (
					<Link
						key={item.id}
						to={`${basePath}/${item.id}`}
						className="group no-underline hover:!no-underline"
					>
						<Card className="h-full gap-3 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
							<div className="aspect-video overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
								{item.imageUrl && (
									<img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
								)}
							</div>
							<h2 className="font-semibold text-zinc-950 group-hover:underline dark:text-white">
								{item.title}
							</h2>
							<p className="text-xs capitalize text-zinc-500">
								{item.status} · {new Date(item.createdAt).toLocaleDateString()}
							</p>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}

function PodcastDetail({ podcast, projectId }: { podcast: Podcast; projectId: string }) {
	const process = useProcessPodcast(projectId);
	const nextAction = !podcast.transcript
		? "transcribe"
		: !podcast.summary
			? "summarise"
			: !podcast.imageUrl
				? "generate-image"
				: null;
	const labels = {
		transcribe: "Transcribe podcast",
		summarise: "Create summary",
		"generate-image": "Generate cover image",
	};

	return (
		<div className="space-y-5">
			{nextAction && (
				<Card className="flex-row items-center justify-between gap-4 p-4 shadow-none">
					<div>
						<p className="text-sm font-medium">Continue processing</p>
						<p className="text-sm text-zinc-500">
							{labels[nextAction]} to build the next part of this project asset.
						</p>
					</div>
					<Button
						variant="primary"
						isLoading={process.isPending}
						onClick={() =>
							process.mutate({
								podcastId: podcast.id,
								action: nextAction,
								numberOfSpeakers: 2,
								speakers: {},
							})
						}
					>
						{labels[nextAction]}
					</Button>
				</Card>
			)}
			{process.error && <p className="text-sm text-red-700">{process.error.message}</p>}
			<PodcastView podcast={podcast} />
		</div>
	);
}

interface ExperienceProps {
	basePath: string;
	projectId: string;
	subpath: string;
}
