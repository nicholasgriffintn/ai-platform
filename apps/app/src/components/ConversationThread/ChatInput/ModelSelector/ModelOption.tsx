import {
	AudioWaveform,
	BrainCircuit,
	Code2,
	Crown,
	Eye,
	Hammer,
	Info,
	Search,
	Sparkles,
	Users,
} from "lucide-react";

import { ModelIcon } from "~/components/ModelIcon";
import { cn } from "~/lib/utils";
import type { ModelConfigItem } from "~/types";

interface ModelOptionProps {
	model: ModelConfigItem;
	isSelected: boolean;
	isActive: boolean;
	onClick: () => void;
	disabled?: boolean;
	mono?: boolean;
	isTeamAgent?: boolean;
	onInfoHoverStart?: (model: ModelConfigItem, anchorRect: DOMRect) => void;
	onInfoHoverEnd?: () => void;
}

export const ModelOption = ({
	model,
	isSelected,
	isActive,
	onClick,
	disabled,
	mono = false,
	isTeamAgent = false,
	onInfoHoverStart,
	onInfoHoverEnd,
}: ModelOptionProps) => {
	const supportsVision =
		model.modalities?.input?.some((modality) =>
			["image", "video"].includes(modality),
		) ||
		model.modalities?.output?.some((modality) =>
			["image", "video"].includes(modality),
		);

	const handleKeyDown = (e: React.KeyboardEvent) => {
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
		model.maxTokens,
	);
	const canShowHoverPreview = showDetailsTrigger && Boolean(onInfoHoverStart);

	return (
		<div
			onClick={disabled ? undefined : onClick}
			onKeyDown={handleKeyDown}
			role="option"
			aria-selected={isSelected}
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
			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 flex-1 items-start gap-2.5">
					<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
						<ModelIcon
							url={model.avatarUrl}
							mono={mono}
							modelName={model.name || model.matchingModel}
							provider={model.provider}
							size={20}
						/>
					</div>
					<div className="min-w-0">
						<div className="flex min-h-[1.4rem] items-center gap-1.5">
							<span className="block min-w-0 font-medium text-zinc-900 whitespace-normal break-words dark:text-zinc-100">
								{model.name || model.matchingModel}
							</span>
							{!model.isFree && (
								<div
									className="rounded-full bg-fuchsia-100 p-0.5 dark:bg-fuchsia-900/30"
									title="Pro"
								>
									<Crown
										size={12}
										className="text-fuchsia-800 dark:text-fuchsia-300"
									/>
								</div>
							)}
							{isTeamAgent ? (
								<div
									className="rounded-full bg-blue-100 p-0.5 dark:bg-blue-900/30"
									title="Team Agent"
								>
									<Users
										size={12}
										className="text-blue-600 dark:text-blue-400"
									/>
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
				<div className="flex w-[108px] flex-shrink-0 items-start justify-end gap-1.5 sm:w-[124px]">
					{model.reasoningConfig?.enabled && (
						<div
							className="rounded-full bg-blue-100 p-1 dark:bg-blue-900/30"
							title="Reasoning"
						>
							<BrainCircuit
								size={12}
								className="text-blue-600 dark:text-blue-400"
							/>
						</div>
					)}
					{model.supportsToolCalls && (
						<div
							className="rounded-full bg-amber-100 p-1 dark:bg-amber-900/30"
							title="Tool Calling"
						>
							<Hammer
								size={12}
								className="text-amber-600 dark:text-amber-400"
							/>
						</div>
					)}
					{(model.multimodal || supportsVision) && (
						<div className="p-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
							<Eye size={12} className="text-blue-600 dark:text-blue-400" />
						</div>
					)}
					{model.supportsSearchGrounding && (
						<div className="p-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30">
							<Search
								size={12}
								className="text-amber-600 dark:text-amber-400"
							/>
						</div>
					)}
					{model.supportsCodeExecution && (
						<div className="p-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
							<Code2
								size={12}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						</div>
					)}
					{model.supportsAudio && (
						<div className="p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
							<AudioWaveform
								size={12}
								className="text-green-600 dark:text-green-400"
							/>
						</div>
					)}
					{model.isFeatured && (
						<div className="p-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30">
							<Sparkles
								size={12}
								className="text-rose-600 dark:text-rose-400"
							/>
						</div>
					)}
					{canShowHoverPreview && (
						<button
							type="button"
							className="cursor-help rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700"
							onClick={(event) => event.stopPropagation()}
							onMouseEnter={(event) => {
								event.stopPropagation();
								onInfoHoverStart?.(
									model,
									event.currentTarget.getBoundingClientRect(),
								);
							}}
							onMouseLeave={() => onInfoHoverEnd?.()}
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
