import { Clock3 } from "lucide-react";

import { ImageModal } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { CanvasMode } from "~/types/canvas";
import {
	getCardAspectClass,
	getMediaPreview,
	getPlaceholderPaletteClass,
} from "./utils";

export interface CanvasRun {
	key: string;
	modelId: string;
	modelName: string;
	predictionId?: string;
	status: "queued" | "processing" | "succeeded" | "completed" | "failed";
	output?: unknown;
	error?: string;
	createdAt?: string;
}

const statusStyles: Record<CanvasRun["status"], string> = {
	queued:
		"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border-blue-200 dark:border-blue-800",
	processing:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800",
	succeeded:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
	completed:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
	failed:
		"bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 border-red-200 dark:border-red-800",
};

export function GenerationCard({
	run,
	index,
	aspectRatio,
	mode,
}: {
	run: CanvasRun;
	index: number;
	aspectRatio?: string;
	mode: CanvasMode;
}) {
	const preview = getMediaPreview(run.output);
	const showPlaceholder = !preview && run.status !== "failed";
	const aspectClass = getCardAspectClass({ mode, aspectRatio, index });
	const paletteClass = getPlaceholderPaletteClass(index);

	return (
		<article className="mb-4 break-inside-avoid rounded-2xl border border-zinc-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/70">
			<div className="mb-3 flex items-start justify-between gap-2">
				<div>
					<h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						{run.modelName}
					</h3>
					{run.createdAt && (
						<p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
							{new Date(run.createdAt).toLocaleTimeString()}
						</p>
					)}
				</div>
				<span
					className={cn(
						"rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
						statusStyles[run.status],
					)}
				>
					{run.status}
				</span>
			</div>

			{showPlaceholder && (
				<div
					className={cn(
						"relative overflow-hidden rounded-xl border border-zinc-200/70 bg-gradient-to-br dark:border-zinc-700",
						paletteClass,
						aspectClass,
					)}
				>
					<div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-white/35 mix-blend-soft-light" />
					<div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/30 mix-blend-soft-light" />
					<div className="absolute left-1/3 top-1/3 h-16 w-16 rounded-full bg-white/20 blur-md" />
					{(run.status === "queued" || run.status === "processing") && (
						<div className="absolute inset-0 flex items-center justify-center text-zinc-800">
							<Clock3 className="mr-2 h-4 w-4 animate-pulse" />
							<span className="text-xs font-medium">Waiting for output</span>
						</div>
					)}
				</div>
			)}

			{preview?.type === "image" && (
				<div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
					<ImageModal
						src={preview.url}
						alt={run.modelName}
						thumbnailClassName="block w-full"
						imageClassName="h-auto w-full rounded-xl object-contain"
					/>
				</div>
			)}

			{preview?.type === "video" && (
				<div
					className={cn(
						"overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700",
						aspectClass,
					)}
				>
					<video controls className="h-full w-full object-cover">
						<source src={preview.url} type="video/mp4" />
					</video>
				</div>
			)}

			{preview?.type === "audio" && (
				<audio controls className="w-full">
					<source src={preview.url} />
				</audio>
			)}

			{run.error && (
				<p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
					{run.error}
				</p>
			)}
		</article>
	);
}
