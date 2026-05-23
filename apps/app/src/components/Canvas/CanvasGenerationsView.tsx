import { Layers, Sparkles } from "lucide-react";

import { cn } from "~/lib/utils";
import { DrawingWorkspace } from "./Drawing/DrawingWorkspace";
import { GenerationCard } from "./GenerationCard";
import type { CanvasStudioState } from "./useCanvasStudio";

export function CanvasGenerationsView({
	canvas,
	className,
}: {
	canvas: CanvasStudioState;
	className?: string;
}) {
	if (canvas.mode === "drawing") {
		return (
			<section className={cn("h-full overflow-auto p-4", className)}>
				<div className="mx-auto max-w-[1400px]">
					<div className="mb-4 flex items-center gap-2">
						<div className="rounded-lg bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
							<Layers className="h-4 w-4" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Drawings</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								Past drawings and transformed outputs appear here.
							</p>
						</div>
					</div>
					<DrawingWorkspace drawing={canvas.drawing} />
				</div>
			</section>
		);
	}

	return (
		<section className={cn("h-full overflow-auto p-4", className)}>
			<div className="mx-auto max-w-[1400px]">
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="rounded-lg bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
							<Layers className="h-4 w-4" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								Generations
							</h2>
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								Outputs from selected models appear here.
							</p>
						</div>
					</div>
					<div className="text-xs text-zinc-500 dark:text-zinc-400">
						{canvas.selectedModelIds.length} active model
						{canvas.selectedModelIds.length === 1 ? "" : "s"}
					</div>
				</div>

				{canvas.isModelsLoading && (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<div
								key={`loading-${index}`}
								className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
							/>
						))}
					</div>
				)}

				{!canvas.isModelsLoading && canvas.displayRuns.length === 0 && (
					<div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
						<Sparkles className="mb-2 h-6 w-6" />
						<p>Select models in the sidebar and run your first generation.</p>
					</div>
				)}

				<div className="columns-1 gap-4 md:columns-2 xl:columns-3">
					{canvas.displayRuns.map((run, index) => (
						<GenerationCard
							key={run.key}
							run={run}
							index={index}
							mode={canvas.mediaMode}
							aspectRatio={canvas.aspectRatio || undefined}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
