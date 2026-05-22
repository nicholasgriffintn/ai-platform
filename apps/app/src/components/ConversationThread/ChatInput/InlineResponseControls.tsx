import { Brain, ChevronDown, ChevronUp, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { getAvailableModels } from "~/lib/models";
import {
	formatReasoningLabel,
	getDefaultReasoningEffort,
	getReasoningOptions,
} from "~/lib/reasoning";
import { cn } from "~/lib/utils";
import { formatVerbosityLabel, getDefaultVerbosity, getVerbosityOptions } from "~/lib/verbosity";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatSettings, ReasoningEffort, VerbosityLevel } from "~/types";

interface InlineResponseControlsProps {
	isDisabled?: boolean;
}

interface InlineSettingSelectProps<T extends string> {
	id: string;
	label: string;
	icon: ReactNode;
	value: T | "";
	displayLabel: string;
	options: Array<{ value: T | ""; label: string }>;
	isDisabled?: boolean;
	onChange: (value: T | "") => void;
}

function InlineSettingSelect<T extends string>({
	id,
	label,
	icon,
	value,
	displayLabel,
	options,
	isDisabled = false,
	onChange,
}: InlineSettingSelectProps<T>) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={isDisabled}
					aria-label={`${label}: ${displayLabel}`}
					aria-haspopup="menu"
					aria-expanded={isOpen}
					className="inline-flex h-8 min-w-8 items-center gap-1.5 rounded-md bg-off-white-highlight px-2 text-xs text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
				>
					<span
						className="flex h-4 w-4 flex-shrink-0 items-center justify-center"
						aria-hidden="true"
					>
						{icon}
					</span>
					<span className="hidden max-w-[130px] truncate lg:inline" title={displayLabel}>
						{displayLabel}
					</span>
					{isOpen ? (
						<ChevronUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
					) : (
						<ChevronDown className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				className="w-56 border-zinc-200 bg-off-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
				aria-label={label}
			>
				<div
					id={id}
					className="px-2 py-1.5 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400"
				>
					{label}
				</div>
				<div role="menu" aria-labelledby={id}>
					{options.map((option) => {
						const isSelected = option.value === value;

						return (
							<button
								key={`${id}-${option.value || "default"}`}
								type="button"
								role="menuitemradio"
								aria-checked={isSelected}
								onClick={() => {
									onChange(option.value);
									setIsOpen(false);
								}}
								className={cn(
									"flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
									isSelected && "bg-zinc-100 font-medium dark:bg-zinc-800",
								)}
							>
								<span>{option.label}</span>
								{isSelected && <span className="text-xs text-zinc-500">Selected</span>}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function InlineResponseControls({ isDisabled = false }: InlineResponseControlsProps) {
	const { chatSettings, model, setChatSettings } = useChatStore();
	const { data: apiModels = {} } = useModels();
	const webLLMModels = useWebLLMModels();
	const availableModels = getAvailableModels(apiModels, true, webLLMModels);
	const selectedModelConfig = model ? availableModels[model] : undefined;

	const reasoningOptions = getReasoningOptions(selectedModelConfig);
	const defaultReasoning = getDefaultReasoningEffort(selectedModelConfig);
	const verbosityOptions = getVerbosityOptions(selectedModelConfig);
	const defaultVerbosity = getDefaultVerbosity(selectedModelConfig);

	const selectedReasoning = chatSettings.reasoning?.effort ?? "";
	const selectedVerbosity = chatSettings.verbosity ?? "";

	const updateChatSettings = (settings: ChatSettings) => {
		setChatSettings(settings);
	};

	const handleReasoningChange = (value: ReasoningEffort | "") => {
		if (!value) {
			updateChatSettings({
				...chatSettings,
				reasoning: undefined,
			});
			return;
		}

		updateChatSettings({
			...chatSettings,
			reasoning: {
				...chatSettings.reasoning,
				effort: value,
			},
		});
	};

	const handleVerbosityChange = (value: VerbosityLevel | "") => {
		updateChatSettings({
			...chatSettings,
			verbosity: value || undefined,
		});
	};

	return (
		<div className="flex flex-shrink-0 items-center gap-1">
			{reasoningOptions.length > 0 && (
				<InlineSettingSelect<ReasoningEffort>
					id="inline-reasoning"
					label="Reasoning depth"
					icon={<Brain className="h-4 w-4" />}
					value={selectedReasoning || defaultReasoning}
					displayLabel={
						selectedReasoning
							? formatReasoningLabel(selectedReasoning)
							: formatReasoningLabel(defaultReasoning)
					}
					options={reasoningOptions.map((option) => ({
						value: option,
						label: formatReasoningLabel(option),
					}))}
					isDisabled={isDisabled}
					onChange={handleReasoningChange}
				/>
			)}
			<InlineSettingSelect<VerbosityLevel>
				id="inline-verbosity"
				label="Verbosity"
				icon={<ListFilter className="h-4 w-4" />}
				value={selectedVerbosity || defaultVerbosity}
				displayLabel={
					selectedVerbosity
						? formatVerbosityLabel(selectedVerbosity)
						: formatVerbosityLabel(defaultVerbosity)
				}
				options={verbosityOptions.map((option) => ({
					value: option,
					label: formatVerbosityLabel(option),
				}))}
				isDisabled={isDisabled}
				onChange={handleVerbosityChange}
			/>
		</div>
	);
}
