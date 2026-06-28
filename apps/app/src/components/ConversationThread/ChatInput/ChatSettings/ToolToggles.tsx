import {
	Code,
	Database,
	Image,
	Layers,
	Link,
	ListFilter,
	Search,
	Terminal,
	type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { useModels } from "~/hooks/useModels";
import { getModelToolOptions, type ModelToolId } from "~/lib/model-tools";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";

interface ToolTogglesProps {
	isDisabled?: boolean;
}

const MODEL_TOOL_ICONS: Record<ModelToolId, LucideIcon> = {
	code_execution: Code,
	file_search: Database,
	hosted_shell: Terminal,
	image_generation: Image,
	mcp: ListFilter,
	search_grounding: Search,
	tool_search: ListFilter,
	web_fetch: Link,
};

interface MenuToggleButtonProps {
	description?: string;
	icon: React.ReactNode;
	isDisabled: boolean;
	isPressed: boolean;
	label: string;
	onToggle: () => void;
}

function MenuToggleButton({
	description,
	icon,
	isDisabled,
	isPressed,
	label,
	onToggle,
}: MenuToggleButtonProps) {
	return (
		<button
			type="button"
			disabled={isDisabled}
			onClick={onToggle}
			aria-label={label}
			className={cn(
				"flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
				isPressed
					? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
					: "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
				isDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
			)}
			aria-pressed={isPressed}
		>
			<span className="flex min-w-0 items-center gap-3">
				{icon}
				<span className="block min-w-0">
					<span className="block truncate font-medium leading-5">{label}</span>
					{description ? (
						<span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
							{description}
						</span>
					) : null}
				</span>
			</span>
			<span
				className={cn(
					"flex h-6 w-10 shrink-0 rounded-full p-0.5",
					isPressed ? "justify-end bg-blue-500" : "bg-zinc-200 dark:bg-zinc-700",
				)}
				aria-hidden="true"
			>
				<span className="h-5 w-5 rounded-full bg-white dark:bg-zinc-300" />
			</span>
		</button>
	);
}

export const ToolToggles = ({ isDisabled = false }: ToolTogglesProps) => {
	const { model, chatMode, isPro, useMultiModel, setUseMultiModel } = useChatStore();
	const { selectedTools, setSelectedTools } = useToolsStore();
	const { data: apiModels } = useModels();

	const modelCapabilities = model ? apiModels?.[model] : undefined;

	const modelToolOptions = React.useMemo(
		() => getModelToolOptions(modelCapabilities),
		[modelCapabilities],
	);

	const toggleTool = (toolName: string) => {
		setSelectedTools(
			selectedTools.includes(toolName)
				? selectedTools.filter((selectedTool) => selectedTool !== toolName)
				: [...selectedTools, toolName],
		);
	};

	const showMultiModelToggle = isPro && !model && chatMode === "remote";

	if (!showMultiModelToggle && modelToolOptions.length === 0) {
		return null;
	}

	const menuOptions = [
		showMultiModelToggle
			? {
					description: "Use multiple models when useful.",
					key: "multi-model",
					icon: <Layers className="h-5 w-5 shrink-0" aria-hidden="true" />,
					isDisabled: false,
					isPressed: useMultiModel,
					label: "Multi-model",
					onToggle: () => setUseMultiModel(!useMultiModel),
				}
			: null,
		...modelToolOptions.map((tool) => {
			const Icon = MODEL_TOOL_ICONS[tool.id];
			return {
				description: tool.availabilityReason,
				isDisabled: !tool.available,
				key: tool.id,
				icon: <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />,
				isPressed: selectedTools.includes(tool.id),
				label: tool.label,
				onToggle: () => toggleTool(tool.id),
			};
		}),
	].filter((option) => option !== null);

	return (
		<div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
			<div className="px-3 pb-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
				Tools
			</div>
			<div className="space-y-1">
				{menuOptions.map((option) => (
					<MenuToggleButton
						key={option.key}
						description={option.description}
						icon={option.icon}
						isDisabled={isDisabled || option.isDisabled}
						isPressed={option.isPressed}
						label={option.label}
						onToggle={option.onToggle}
					/>
				))}
			</div>
		</div>
	);
};
