import { Code, Layers, Search } from "lucide-react";
import * as React from "react";

import { Toggle } from "~/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useModels } from "~/hooks/useModels";
import { cn } from "~/lib/utils";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";

interface ToolTogglesProps {
	isDisabled?: boolean;
	variant?: "inline" | "menu";
}

interface MenuToggleButtonProps {
	icon: React.ReactNode;
	isDisabled: boolean;
	isPressed: boolean;
	label: string;
	onToggle: () => void;
}

function MenuToggleButton({ icon, isDisabled, isPressed, label, onToggle }: MenuToggleButtonProps) {
	return (
		<button
			type="button"
			disabled={isDisabled}
			onClick={onToggle}
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
				<span className="block truncate font-medium leading-5">{label}</span>
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

export const ToolToggles = ({ isDisabled = false, variant = "inline" }: ToolTogglesProps) => {
	const { model, chatMode, isPro, useMultiModel, setUseMultiModel } = useChatStore();
	const { selectedTools, setSelectedTools } = useToolsStore();
	const { data: apiModels } = useModels();

	const modelCapabilities = model ? apiModels?.[model] : undefined;

	const supportsToolCalls = modelCapabilities?.supportsToolCalls;
	const supportsSearchGrounding = modelCapabilities?.supportsSearchGrounding;
	const supportsCodeExecution = modelCapabilities?.supportsCodeExecution;

	const availableTools = React.useMemo(() => {
		const tools: string[] = [];
		if (supportsCodeExecution) tools.push("code_execution");
		if (supportsSearchGrounding) tools.push("search_grounding");
		return tools;
	}, [supportsCodeExecution, supportsSearchGrounding]);

	const handleValueChange = (value: string[]) => {
		setSelectedTools(value);
	};

	const toggleTool = (toolName: string) => {
		setSelectedTools(
			selectedTools.includes(toolName)
				? selectedTools.filter((selectedTool) => selectedTool !== toolName)
				: [...selectedTools, toolName],
		);
	};

	const showMultiModelToggle = isPro && !model && chatMode === "remote";

	if (!showMultiModelToggle && (!supportsToolCalls || availableTools.length === 0)) {
		return null;
	}

	if (variant === "menu") {
		const menuOptions = [
			showMultiModelToggle
				? {
						key: "multi-model",
						icon: <Layers className="h-5 w-5 shrink-0" aria-hidden="true" />,
						isPressed: useMultiModel,
						label: "Multi-model",
						onToggle: () => setUseMultiModel(!useMultiModel),
					}
				: null,
			supportsCodeExecution
				? {
						key: "code-execution",
						icon: <Code className="h-5 w-5 shrink-0" aria-hidden="true" />,
						isPressed: selectedTools.includes("code_execution"),
						label: "Code execution",
						onToggle: () => toggleTool("code_execution"),
					}
				: null,
			supportsSearchGrounding
				? {
						key: "search-grounding",
						icon: <Search className="h-5 w-5 shrink-0" aria-hidden="true" />,
						isPressed: selectedTools.includes("search_grounding"),
						label: "Search grounding",
						onToggle: () => toggleTool("search_grounding"),
					}
				: null,
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
							icon={option.icon}
							isDisabled={isDisabled}
							isPressed={option.isPressed}
							label={option.label}
							onToggle={option.onToggle}
						/>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center">
			{showMultiModelToggle && (
				<div className="flex items-center gap-1.5 ml-1">
					<Toggle
						pressed={useMultiModel}
						onPressedChange={setUseMultiModel}
						disabled={isDisabled}
						title="Toggle multi-model mode"
						aria-label="Toggle multi-model mode"
						size="sm"
					>
						<Layers className="h-3 w-3" />
					</Toggle>
				</div>
			)}

			{supportsToolCalls && availableTools.length !== 0 ? (
				<ToggleGroup
					type="multiple"
					size="sm"
					value={selectedTools.filter((tool) => availableTools.includes(tool))}
					onValueChange={handleValueChange}
					disabled={isDisabled}
					aria-label="Select tools"
					className="ml-1"
				>
					{supportsCodeExecution && (
						<ToggleGroupItem
							value="code_execution"
							aria-label="Toggle code execution"
							title={
								selectedTools.includes("code_execution")
									? "Disable code execution"
									: "Enable code execution"
							}
						>
							<Code className="h-4 w-4" />
						</ToggleGroupItem>
					)}
					{supportsSearchGrounding && (
						<ToggleGroupItem
							value="search_grounding"
							aria-label="Toggle search grounding"
							title={
								selectedTools.includes("search_grounding")
									? "Disable search grounding"
									: "Enable search grounding"
							}
						>
							<Search className="h-4 w-4" />
						</ToggleGroupItem>
					)}
				</ToggleGroup>
			) : null}
		</div>
	);
};
