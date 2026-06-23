import {
	AudioWaveform,
	BrainCircuit,
	ChevronDown,
	Code2,
	Crown,
	Eye,
	Globe2,
	Hammer,
	Info,
	Search,
	Sparkles,
	Users,
} from "lucide-react";

import { ModelIcon } from "~/components/ModelIcon";
import type { ModelRegionOption } from "~/lib/model-region-variants";
import { getModelDisplayName, modelSupportsVisualModality } from "~/lib/models";
import { hasProviderReasoningOptions } from "~/lib/reasoning";
import { cn } from "~/lib/utils";
import type { ModelConfigItem } from "@assistant/schemas";

interface ModelOptionProps {
	model: ModelConfigItem;
	isSelected: boolean;
	isActive: boolean;
	onClick: () => void;
	disabled?: boolean;
	mono?: boolean;
	isTeamAgent?: boolean;
	regionOptions?: ModelRegionOption[];
	selectedRegionModelId?: string;
	onRegionSelect?: (modelId: string) => void;
	onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
	onInfoHoverEnd?: () => void;
}

function isInteractiveEventTarget(target: EventTarget | null) {
	return (
		target instanceof HTMLButtonElement ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLSelectElement ||
		target instanceof HTMLTextAreaElement
	);
}

export const ModelOption = ({
	model,
	isSelected,
	isActive,
	onClick,
	disabled,
	mono = false,
	isTeamAgent = false,
	regionOptions = [],
	selectedRegionModelId,
	onRegionSelect,
	onInfoHoverStart,
	onInfoHoverEnd,
}: ModelOptionProps) => {
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (isInteractiveEventTarget(e.target)) {
			return;
		}
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (!disabled) {
				onClick();
			}
		}
	};

	const showDetailsTrigger = Boolean(
		model.description ||
		(model.strengths && model.strengths.length > 0) ||
		model.contextWindow ||
		model.maxTokens ||
		model.artificialAnalysis,
	);
	const canShowHoverPreview = showDetailsTrigger && Boolean(onInfoHoverStart);
	const hasRegionOptions = regionOptions.length > 1;
	const showModelDetails = (event: React.SyntheticEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		const rowElement = event.currentTarget.closest('[role="option"]');
		const anchorElement = rowElement instanceof HTMLElement ? rowElement : event.currentTarget;
		onInfoHoverStart?.(model, anchorElement.getBoundingClientRect());
	};

	return (
		<div
			onClick={disabled ? undefined : onClick}
			onKeyDown={handleKeyDown}
			role="option"
			aria-selected={isSelected}
			aria-disabled={disabled || undefined}
			id={`model-${model.matchingModel}`}
			tabIndex={disabled ? -1 : 0}
			className={cn(
				"w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
				!disabled
					? "cursor-pointer"
					: "cursor-not-allowed border-zinc-200/60 opacity-50 dark:border-zinc-700/60",
				isSelected
					? "border-fuchsia-300/70 bg-fuchsia-50/70 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/30"
					: isActive
						? "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/70"
						: "border-transparent hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60",
			)}
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 flex-1 items-start gap-2.5">
					<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
						<ModelIcon
							url={model.avatarUrl}
							mono={mono}
							modelName={getModelDisplayName(model)}
							provider={model.provider}
							size={20}
						/>
					</div>
					<div className="min-w-0">
						<div className="flex min-h-[1.4rem] flex-wrap items-center gap-1.5">
							<span className="block min-w-0 font-medium text-zinc-900 whitespace-normal break-words dark:text-zinc-100">
								{getModelDisplayName(model)}
							</span>
							{!model.isFree && !model.isByokEnabled && (
								<div
									className="rounded-full bg-fuchsia-100 p-0.5 dark:bg-fuchsia-900/30"
									title="Pro"
								>
									<Crown size={12} className="text-fuchsia-800 dark:text-fuchsia-300" />
								</div>
							)}
							{model.isByokEnabled ? (
								<span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
									BYOK
								</span>
							) : null}
							{isTeamAgent ? (
								<div
									className="rounded-full bg-blue-100 p-0.5 dark:bg-blue-900/30"
									title="Team Agent"
								>
									<Users size={12} className="text-blue-600 dark:text-blue-400" />
								</div>
							) : null}
						</div>
						{model.description ? (
							<p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400 whitespace-normal break-words">
								{model.description}
							</p>
						) : null}
					</div>
				</div>
				<div className="flex w-full flex-wrap items-center gap-1.5 pl-[2.6rem] sm:w-[124px] sm:flex-shrink-0 sm:justify-end sm:pl-0">
					{hasRegionOptions && (
						<label className="relative flex max-w-[112px] items-center" title="Region">
							<Globe2
								size={12}
								className="pointer-events-none absolute left-1.5 text-zinc-500 dark:text-zinc-400"
							/>
							<select
								aria-label={`Select region for ${getModelDisplayName(model)}`}
								value={selectedRegionModelId || model.id}
								disabled={disabled}
								onClick={(event) => event.stopPropagation()}
								onMouseDown={(event) => event.stopPropagation()}
								onChange={(event) => {
									event.stopPropagation();
									onRegionSelect?.(event.target.value);
								}}
								className="h-6 w-full cursor-pointer appearance-none rounded-full border border-zinc-200 bg-white py-0 pl-5 pr-5 text-[11px] font-medium text-zinc-700 focus:border-zinc-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
							>
								{regionOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
							<ChevronDown
								size={10}
								className="pointer-events-none absolute right-1.5 text-zinc-500 dark:text-zinc-400"
							/>
						</label>
					)}
					{hasProviderReasoningOptions(model) && (
						<div className="rounded-full bg-blue-100 p-1 dark:bg-blue-900/30" title="Reasoning">
							<BrainCircuit size={12} className="text-blue-600 dark:text-blue-400" />
						</div>
					)}
					{model.supportsToolCalls && (
						<div
							className="rounded-full bg-amber-100 p-1 dark:bg-amber-900/30"
							title="Tool Calling"
						>
							<Hammer size={12} className="text-amber-600 dark:text-amber-400" />
						</div>
					)}
					{modelSupportsVisualModality(model) && (
						<div className="rounded-full bg-blue-100 p-1 dark:bg-blue-900/30">
							<Eye size={12} className="text-blue-600 dark:text-blue-400" />
						</div>
					)}
					{model.supportsSearchGrounding && (
						<div className="rounded-full bg-amber-100 p-1 dark:bg-amber-900/30">
							<Search size={12} className="text-amber-600 dark:text-amber-400" />
						</div>
					)}
					{model.supportsCodeExecution && (
						<div className="rounded-full bg-emerald-100 p-1 dark:bg-emerald-900/30">
							<Code2 size={12} className="text-emerald-600 dark:text-emerald-400" />
						</div>
					)}
					{model.supportsAudio && (
						<div className="rounded-full bg-green-100 p-1 dark:bg-green-900/30">
							<AudioWaveform size={12} className="text-green-600 dark:text-green-400" />
						</div>
					)}
					{model.isFeatured && (
						<div className="rounded-full bg-rose-100 p-1 dark:bg-rose-900/30">
							<Sparkles size={12} className="text-rose-600 dark:text-rose-400" />
						</div>
					)}
					{canShowHoverPreview && (
						<button
							type="button"
							className="cursor-help rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700"
							onClick={showModelDetails}
							onFocus={showModelDetails}
							onMouseEnter={showModelDetails}
							onBlur={() => onInfoHoverEnd?.()}
							aria-label="View model details"
						>
							<Info size={13} className="text-zinc-500" />
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
