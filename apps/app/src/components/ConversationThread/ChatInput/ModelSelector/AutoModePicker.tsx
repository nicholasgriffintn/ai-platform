import { Check, Crown, Gauge, Network, Rocket, Sparkles, Wand2, Zap } from "lucide-react";
import { useState } from "react";

import { ModelIcon } from "~/components/ModelIcon";
import {
	AUTO_ROUTER_MODES,
	countAutoRouterModeCandidates,
	getAutoRouterModeCandidates,
	type AutoRouterModeDefinition,
} from "~/lib/auto-router-modes";
import { getModelDisplayName } from "~/lib/models";
import { cn } from "~/lib/utils";
import type { ModelConfigItem, ModelRouterMode } from "@assistant/schemas";

interface AutoModePickerProps {
	models: ModelConfigItem[];
	selectedMode: ModelRouterMode;
	disabled?: boolean;
	onSelectMode: (mode: ModelRouterMode) => void;
}

function getModeIcon(mode: ModelRouterMode) {
	switch (mode) {
		case "lite":
			return Zap;
		case "standard":
			return Sparkles;
		case "pro":
			return Rocket;
		case "max":
			return Crown;
		case "auto":
			return Wand2;
	}
}

function getModeTone(mode: ModelRouterMode) {
	switch (mode) {
		case "auto":
			return {
				icon: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
				selected:
					"border-fuchsia-300/70 bg-fuchsia-50/80 text-fuchsia-950 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/30 dark:text-fuchsia-100",
				check: "text-fuchsia-700 dark:text-fuchsia-200",
				panelIcon:
					"border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/30 dark:text-fuchsia-200",
				panelCard:
					"border-fuchsia-200/70 bg-fuchsia-50/60 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/20",
				panelLabel: "text-fuchsia-700 dark:text-fuchsia-200",
			};
		case "lite":
			return {
				icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200",
				selected:
					"border-sky-300/70 bg-sky-50/80 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-100",
				check: "text-sky-700 dark:text-sky-200",
				panelIcon:
					"border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-200",
				panelCard: "border-sky-200/70 bg-sky-50/60 dark:border-sky-500/30 dark:bg-sky-950/20",
				panelLabel: "text-sky-700 dark:text-sky-200",
			};
		case "standard":
			return {
				icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
				selected:
					"border-emerald-300/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-100",
				check: "text-emerald-700 dark:text-emerald-200",
				panelIcon:
					"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200",
				panelCard:
					"border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-950/20",
				panelLabel: "text-emerald-700 dark:text-emerald-200",
			};
		case "pro":
			return {
				icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
				selected:
					"border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100",
				check: "text-amber-700 dark:text-amber-200",
				panelIcon:
					"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200",
				panelCard:
					"border-amber-200/70 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-950/20",
				panelLabel: "text-amber-700 dark:text-amber-200",
			};
		case "max":
			return {
				icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
				selected:
					"border-rose-300/70 bg-rose-50/80 text-rose-950 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100",
				check: "text-rose-700 dark:text-rose-200",
				panelIcon:
					"border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200",
				panelCard: "border-rose-200/70 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-950/20",
				panelLabel: "text-rose-700 dark:text-rose-200",
			};
	}
}

function getCandidateText(count: number) {
	return `${count} candidate${count === 1 ? "" : "s"}`;
}

function ModeDetail({
	mode,
	models,
}: {
	mode: AutoRouterModeDefinition;
	models: ModelConfigItem[];
}) {
	const candidateCount = countAutoRouterModeCandidates(models, mode.id);
	const candidates = getAutoRouterModeCandidates(models, mode.id);
	const exampleModels = candidates.slice(0, 3);
	const remainingModelCount = Math.max(0, candidates.length - exampleModels.length);
	const Icon = getModeIcon(mode.id);
	const tone = getModeTone(mode.id);

	return (
		<div className="flex min-h-[17rem] flex-col rounded-lg border border-zinc-200 bg-white/70 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border",
						tone.panelIcon,
					)}
				>
					<Icon className="h-4 w-4" aria-hidden="true" />
				</div>
				<div className="min-w-0">
					<h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{mode.label}</h4>
					<p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
						{mode.description}
					</p>
				</div>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-2 text-xs">
				<div className={cn("rounded-md border p-2", tone.panelCard)}>
					<div className={cn("flex items-center gap-1.5", tone.panelLabel)}>
						<Gauge className="h-3.5 w-3.5" aria-hidden="true" />
						<span>Filter</span>
					</div>
					<p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
						{mode.filterSummary}
					</p>
				</div>
				<div className={cn("rounded-md border p-2", tone.panelCard)}>
					<div className={cn("flex items-center gap-1.5", tone.panelLabel)}>
						<Network className="h-3.5 w-3.5" aria-hidden="true" />
						<span>Router pool</span>
					</div>
					<p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
						{getCandidateText(candidateCount)}
					</p>
				</div>
			</div>

			<div className="mt-auto pt-4">
				{exampleModels.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{exampleModels.map((model) => {
							const modelName = getModelDisplayName(model);

							return (
								<span
									key={`${mode.id}-${model.id || model.matchingModel}`}
									className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
									title={`${modelName} (${model.provider})`}
								>
									<ModelIcon
										url={model.avatarUrl}
										modelName={modelName}
										provider={model.provider}
										size={13}
									/>
									<span className="min-w-0 max-w-32 truncate">{modelName}</span>
								</span>
							);
						})}
						{remainingModelCount > 0 ? (
							<span className="inline-flex items-center rounded-full border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
								+{remainingModelCount} more...
							</span>
						) : null}
					</div>
				) : (
					<p className="text-xs text-zinc-500 dark:text-zinc-400">
						No matching router models are available.
					</p>
				)}
			</div>
		</div>
	);
}

export function AutoModePicker({
	models,
	selectedMode,
	disabled,
	onSelectMode,
}: AutoModePickerProps) {
	const selectedDefinition =
		AUTO_ROUTER_MODES.find((mode) => mode.id === selectedMode) ?? AUTO_ROUTER_MODES[0];
	const [previewMode, setPreviewMode] = useState<ModelRouterMode | null>(null);
	const previewDefinition =
		AUTO_ROUTER_MODES.find((mode) => mode.id === previewMode) ?? selectedDefinition;

	return (
		<div className="grid min-h-0 gap-3 p-3 md:grid-cols-[minmax(12rem,0.82fr)_minmax(16rem,1.18fr)]">
			<div className="space-y-1.5">
				{AUTO_ROUTER_MODES.map((mode) => {
					const Icon = getModeIcon(mode.id);
					const isSelected = mode.id === selectedDefinition.id;
					const tone = getModeTone(mode.id);

					return (
						<button
							key={mode.id}
							type="button"
							role="option"
							aria-label={`${mode.label} automatic mode`}
							aria-selected={isSelected}
							disabled={disabled}
							onMouseEnter={() => setPreviewMode(mode.id)}
							onFocus={() => setPreviewMode(mode.id)}
							onMouseLeave={() => setPreviewMode(null)}
							onBlur={() => setPreviewMode(null)}
							onClick={() => onSelectMode(mode.id)}
							className={cn(
								"flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
								isSelected
									? tone.selected
									: "border-transparent bg-zinc-100/70 text-zinc-700 hover:border-zinc-300 hover:bg-white dark:bg-zinc-800/70 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
							)}
						>
							<span
								className={cn(
									"flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
									tone.icon,
								)}
							>
								<Icon className="h-4 w-4" aria-hidden="true" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-sm font-semibold">{mode.label}</span>
								<span
									className={cn(
										"block truncate text-xs",
										isSelected ? "text-current opacity-75" : "text-zinc-500 dark:text-zinc-400",
									)}
								>
									{mode.tagline}
								</span>
							</span>
							{isSelected ? (
								<Check className={cn("h-4 w-4 flex-shrink-0", tone.check)} aria-hidden="true" />
							) : null}
						</button>
					);
				})}
			</div>
			<ModeDetail mode={previewDefinition} models={models} />
		</div>
	);
}
