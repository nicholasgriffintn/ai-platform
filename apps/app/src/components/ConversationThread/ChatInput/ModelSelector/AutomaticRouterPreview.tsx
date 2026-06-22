import { BrainCircuit, Code2, Eye, Gauge, Network, Sparkles, Wand2 } from "lucide-react";
import { useMemo } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import { buildAutomaticRouterPreview } from "~/lib/model-router-preview";
import { cn } from "~/lib/utils";
import type { ModelConfigItem } from "@assistant/schemas";

interface AutomaticRouterPreviewProps {
	models: ModelConfigItem[];
	isSelected: boolean;
	onSelect: () => void;
}

function getLaneIcon(laneId: string) {
	switch (laneId) {
		case "fast":
			return Gauge;
		case "reasoning":
			return BrainCircuit;
		case "code":
			return Code2;
		case "vision-files":
			return Eye;
		default:
			return Wand2;
	}
}

export function AutomaticRouterPreview({
	models,
	isSelected,
	onSelect,
}: AutomaticRouterPreviewProps) {
	const preview = useMemo(() => buildAutomaticRouterPreview(models), [models]);

	return (
		<div className="space-y-3 p-3">
			<button
				type="button"
				role="option"
				aria-selected={isSelected}
				onClick={onSelect}
				className={cn(
					"w-full rounded-lg border p-3 text-left transition-colors",
					isSelected
						? "border-fuchsia-300/80 bg-fuchsia-50/80 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/30"
						: "border-zinc-200 bg-white/70 hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80",
				)}
			>
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-fuchsia-200 bg-white text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/40 dark:text-fuchsia-200">
						<Wand2 className="h-4 w-4" aria-hidden="true" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								Automatic routing
							</h4>
							{isSelected ? (
								<span className="rounded-full border border-fuchsia-200 bg-white px-2 py-0.5 text-[11px] font-medium text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/30 dark:text-fuchsia-200">
									Selected
								</span>
							) : null}
						</div>
						<p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
							Analyses your prompt, attachments, tools, and budget before choosing a routed model.
						</p>
					</div>
				</div>
			</button>

			<div className="grid grid-cols-2 gap-2 text-xs">
				<div className="rounded-lg border border-zinc-200 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
					<div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
						<Network className="h-3.5 w-3.5" aria-hidden="true" />
						<span>Router pool</span>
					</div>
					<p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
						{preview.candidateCount} model{preview.candidateCount === 1 ? "" : "s"}
					</p>
				</div>
				<div className="rounded-lg border border-zinc-200 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
					<div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
						<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
						<span>Providers</span>
					</div>
					<p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
						{preview.providerCount} available
					</p>
				</div>
			</div>

			{preview.lanes.length > 0 ? (
				<div className="grid gap-2 sm:grid-cols-2">
					{preview.lanes.map((lane) => {
						const Icon = getLaneIcon(lane.id);

						return (
							<div
								key={lane.id}
								className="rounded-lg border border-zinc-200 bg-white/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/60"
							>
								<div className="flex items-start gap-2">
									<div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
										<Icon className="h-3.5 w-3.5" aria-hidden="true" />
									</div>
									<div className="min-w-0 flex-1">
										<h5 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
											{lane.title}
										</h5>
										<p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
											{lane.description}
										</p>
									</div>
								</div>
								<p className="mt-2 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
									{lane.criteria}
								</p>
								<div className="mt-2 flex flex-wrap gap-1.5">
									{lane.models.map((model) => (
										<span
											key={`${lane.id}-${model.id}`}
											className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
											title={`${model.name} (${model.provider})`}
										>
											<ModelIcon
												url={model.avatarUrl}
												modelName={model.name}
												provider={model.provider}
												size={13}
											/>
											<span className="min-w-0 truncate">{model.name}</span>
										</span>
									))}
									{lane.moreModelCount > 0 ? (
										<span className="inline-flex items-center rounded-full border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
											+{lane.moreModelCount} more
										</span>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
					No automatic router candidates are available for your current access level.
				</div>
			)}
		</div>
	);
}
