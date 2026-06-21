import {
	AppWindow,
	AtSign,
	Bot,
	Check,
	Command,
	Loader2,
	Plug,
	ScrollText,
	Search,
	Wrench,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { AssistantActionItem, AssistantActionItemKind } from "@assistant/schemas";

import { Button, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import type { ComposerDirectiveQuery } from "~/lib/composer-commands";
import { cn } from "~/lib/utils";
import type { ComposerCommandAction } from "./composerCommandTypes";
import { useComposerCommandActions } from "./useComposerCommandActions";

interface ComposerCommandsState {
	modeCommands: ComposerCommandAction[];
	activeModeControls?: ReactNode;
	directive: ComposerDirectiveQuery | null;
	chatInput: string;
	setChatInput: (value: string) => void;
	isDisabled?: boolean;
	activeSuggestionIndex?: number;
	includeSettingCommands?: boolean;
	onActiveSuggestionIndexChange?: (index: number) => void;
	onActionItemSelect?: (item: AssistantActionItem) => void;
	onSlashCommandSelect?: (command: ComposerCommandAction) => void;
}

function CommandRow({
	children,
	description,
	icon,
	isActive,
	isDisabled,
	onClick,
	title,
	isHighlighted,
	onHighlight,
}: {
	children: ReactNode;
	description?: string;
	icon: ReactNode;
	isActive?: boolean;
	isDisabled?: boolean;
	onClick: () => void;
	title: string;
	isHighlighted?: boolean;
	onHighlight?: () => void;
}) {
	return (
		<button
			type="button"
			disabled={isDisabled}
			onClick={onClick}
			onMouseEnter={onHighlight}
			data-composer-command-highlighted={isHighlighted ? "true" : undefined}
			className={cn(
				"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
				isActive
					? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
					: "text-zinc-700 hover:bg-blue-50 hover:text-blue-950 dark:text-zinc-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-100",
				isHighlighted &&
					"bg-blue-50 text-blue-950 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-800",
				isDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
			)}
			title={title}
		>
			<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-medium leading-5">{children}</span>
				{description && (
					<span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
						{description}
					</span>
				)}
			</span>
			{isActive && <Check className="h-4 w-4 text-blue-500" aria-hidden="true" />}
		</button>
	);
}

function ActionItemAvatar({ item }: { item: AssistantActionItem }) {
	if (item.kind === "agent") {
		return <Bot className="h-4 w-4" aria-hidden="true" />;
	}
	if (item.kind === "app") {
		return <AppWindow className="h-4 w-4" aria-hidden="true" />;
	}
	if (item.kind === "connector") {
		return <Plug className="h-4 w-4" aria-hidden="true" />;
	}
	if (item.kind === "tool") {
		return <Wrench className="h-4 w-4" aria-hidden="true" />;
	}
	return <ScrollText className="h-4 w-4" aria-hidden="true" />;
}

const ACTION_ITEM_GROUPS: Array<{
	kinds: AssistantActionItemKind[];
	label: string;
	emptyLabel: string;
}> = [
	{ kinds: ["installed_recipe", "recipe"], label: "Recipes", emptyLabel: "recipes" },
	{ kinds: ["app"], label: "Apps", emptyLabel: "apps" },
	{ kinds: ["agent"], label: "Agents", emptyLabel: "agents" },
	{ kinds: ["connector"], label: "Connectors", emptyLabel: "connectors" },
	{ kinds: ["tool"], label: "Tools", emptyLabel: "tools" },
];

function groupActionItems(items: AssistantActionItem[]) {
	return ACTION_ITEM_GROUPS.map((group) => ({
		...group,
		items: items.filter((item) => group.kinds.includes(item.kind)),
	})).filter((group) => group.items.length > 0);
}

function describeActionItem(item: AssistantActionItem): string {
	if (item.description) {
		return item.description;
	}
	if (item.status) {
		return item.status;
	}
	if (item.kind === "installed_recipe" || item.kind === "recipe") {
		return "Use this recipe";
	}
	return `Use this ${item.kind}`;
}

function SectionLabel({ children }: { children: ReactNode }) {
	return (
		<div className="px-3 pb-1 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
			{children}
		</div>
	);
}

function ContextChip({
	children,
	className,
	kind,
}: {
	children: ReactNode;
	className: string;
	kind: "action" | "agent" | "attachment" | "mode" | "skill";
}) {
	return (
		<span
			data-composer-context-chip={kind}
			contentEditable={false}
			className={cn(
				"inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
				className,
			)}
		>
			{children}
		</span>
	);
}

function ChipRemoveButton({
	className,
	label,
	onClick,
}: {
	className: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
			<X className="h-3.5 w-3.5" aria-hidden="true" />
		</button>
	);
}

interface ComposerAttachmentChipState {
	label: string;
	onClear: () => void;
	preview: ReactNode;
}

export function ComposerCommandChips(
	props: ComposerCommandsState & {
		attachments?: ComposerAttachmentChipState[];
		hideAgentChip?: boolean;
		onClearMode?: () => void;
	},
) {
	const { clearAgent, selectedAgent } = useComposerCommandActions(props);
	const activeMode = props.modeCommands.find(
		(command) => command.isActive && command.command !== "chat",
	);

	const shouldShowAgent = selectedAgent && !props.hideAgentChip;

	if (!props.attachments?.length && !activeMode && !shouldShowAgent) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-2 px-3 pt-3">
			{props.attachments?.map((attachment, index) => (
				<ContextChip
					key={`${attachment.label}-${index}`}
					className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100"
					kind="attachment"
				>
					<span className="flex h-4 w-4 shrink-0 items-center justify-center text-amber-700 dark:text-amber-200">
						{attachment.preview}
					</span>
					<span className="truncate">{attachment.label}</span>
					<ChipRemoveButton
						onClick={attachment.onClear}
						className="rounded-sm text-amber-700 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
						label="Remove attachment"
					/>
				</ContextChip>
			))}
			{activeMode && (
				<ContextChip
					kind="mode"
					className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100"
				>
					<span
						className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-emerald-700 dark:text-emerald-200"
						aria-hidden="true"
					>
						{activeMode.icon}
					</span>
					<span className="truncate">{activeMode.label}</span>
					{props.onClearMode && (
						<ChipRemoveButton
							onClick={props.onClearMode}
							className="rounded-sm text-emerald-700 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-emerald-50"
							label={`Clear ${activeMode.label} mode`}
						/>
					)}
				</ContextChip>
			)}
			{shouldShowAgent && (
				<ContextChip
					kind="agent"
					className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100"
				>
					<AtSign
						className="h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-200"
						aria-hidden="true"
					/>
					<span className="truncate">{selectedAgent.name}</span>
					<ChipRemoveButton
						onClick={clearAgent}
						className="rounded-sm text-blue-700 hover:text-blue-950 dark:text-blue-200 dark:hover:text-blue-50"
						label={`Clear ${selectedAgent.name} agent`}
					/>
				</ContextChip>
			)}
		</div>
	);
}

export function ComposerCommandSuggestions(props: ComposerCommandsState) {
	const {
		canUseAgents,
		filteredActionItems,
		filteredSlashCommands,
		isLoadingAgents,
		selectActionItem,
		selectSlashCommand,
	} = useComposerCommandActions(props);
	const listRef = useRef<HTMLDivElement>(null);

	const isModeQuery = props.directive?.trigger === "/";
	const resultsCount = props.directive
		? isModeQuery
			? filteredSlashCommands.length
			: filteredActionItems.length
		: 0;
	const activeIndex = Math.min(props.activeSuggestionIndex ?? 0, Math.max(resultsCount - 1, 0));
	const hasResults = resultsCount > 0;

	useEffect(() => {
		if (!props.directive || props.isDisabled) {
			return;
		}

		const highlightedRow = listRef.current?.querySelector<HTMLElement>(
			'[data-composer-command-highlighted="true"]',
		);
		if (typeof highlightedRow?.scrollIntoView === "function") {
			highlightedRow.scrollIntoView({ block: "nearest" });
		}
	}, [
		activeIndex,
		props.directive?.query,
		props.directive?.trigger,
		props.isDisabled,
		resultsCount,
	]);

	if (!props.directive || props.isDisabled) {
		return null;
	}

	return (
		<div className="absolute bottom-full left-3 right-3 z-50 mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-off-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
			<div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
				{isModeQuery ? (
					<Command className="h-3.5 w-3.5" aria-hidden="true" />
				) : (
					<AtSign className="h-3.5 w-3.5" aria-hidden="true" />
				)}
				<span>{isModeQuery ? "Commands" : "Recipes, apps, and agents"}</span>
			</div>
			<div ref={listRef} className="max-h-72 overflow-y-auto p-2">
				{isModeQuery ? (
					filteredSlashCommands.map((command, index) => (
						<CommandRow
							key={command.id}
							icon={command.icon}
							description={
								command.disabled
									? (command.disabledReason ?? command.description)
									: command.description
							}
							isActive={command.isActive}
							isDisabled={command.disabled}
							isHighlighted={index === activeIndex}
							onHighlight={() => props.onActiveSuggestionIndexChange?.(index)}
							onClick={() => props.onSlashCommandSelect?.(command) ?? selectSlashCommand(command)}
							title={command.disabled ? (command.disabledReason ?? command.label) : command.label}
						>
							/{command.command}
						</CommandRow>
					))
				) : !canUseAgents ? (
					<div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
						Recipes, apps, and agents are available in Chat mode.
					</div>
				) : isLoadingAgents ? (
					<div className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						<span>Loading recipes, apps, and agents...</span>
					</div>
				) : (
					groupActionItems(filteredActionItems).map((group) => (
						<div key={group.label} className="space-y-1">
							<SectionLabel>{group.label}</SectionLabel>
							{group.items.map((item) => {
								const itemIndex = filteredActionItems.findIndex(
									(candidate) => candidate.id === item.id,
								);
								return (
									<CommandRow
										key={item.id}
										icon={<ActionItemAvatar item={item} />}
										description={describeActionItem(item)}
										isActive={false}
										isHighlighted={itemIndex === activeIndex}
										onHighlight={() => props.onActiveSuggestionIndexChange?.(itemIndex)}
										onClick={() => props.onActionItemSelect?.(item) ?? selectActionItem(item)}
										title={item.label}
									>
										@{item.label}
									</CommandRow>
								);
							})}
						</div>
					))
				)}
				{!hasResults && !isLoadingAgents && (
					<div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
						No {isModeQuery ? "commands" : "recipes, apps, or agents"} match this command.
					</div>
				)}
			</div>
		</div>
	);
}

export function ComposerCommandButton(props: ComposerCommandsState) {
	const {
		actionItems,
		canUseAgents,
		isLoadingAgents,
		modeCommands,
		selectActionItem,
		selectSlashCommand,
		selectedAgent,
		settingCommands,
	} = useComposerCommandActions(props);
	const [isOpen, setIsOpen] = useState(false);
	const keepOpenAfterSelectionRef = useRef(false);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && keepOpenAfterSelectionRef.current) {
			keepOpenAfterSelectionRef.current = false;
			setIsOpen(true);
			return;
		}
		setIsOpen(nextOpen);
	};

	const handleCommandSelect = (command: ComposerCommandAction) => {
		const shouldKeepPopoverOpen = Boolean(command.keepPopoverOpen && !command.disabled);
		if (shouldKeepPopoverOpen) {
			keepOpenAfterSelectionRef.current = true;
		}
		if (props.onSlashCommandSelect) {
			props.onSlashCommandSelect(command);
		} else {
			selectSlashCommand(command);
		}
		if (shouldKeepPopoverOpen) {
			setIsOpen(true);
			globalThis.setTimeout(() => {
				keepOpenAfterSelectionRef.current = false;
			}, 0);
		}
	};

	const handleActionItemSelect = (item: AssistantActionItem) => {
		if (props.onActionItemSelect) {
			props.onActionItemSelect(item);
			return;
		}
		selectActionItem(item);
	};

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="icon"
					className="h-8 w-8 shrink-0 p-1.5"
					disabled={props.isDisabled}
					title="Open commands"
					aria-label="Open commands"
				>
					<Command className="h-4 w-4" aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				sideOffset={10}
				className="w-96 max-w-[92vw] rounded-xl p-2"
			>
				<div className="max-h-[min(34rem,72dvh)] overflow-y-auto pr-1">
					<div className="space-y-3">
						<div>
							<SectionLabel>Modes</SectionLabel>
							<div className="space-y-1">
								{modeCommands.map((command) => (
									<CommandRow
										key={command.id}
										icon={command.icon}
										description={
											command.disabled
												? (command.disabledReason ?? command.description)
												: `/${command.command} - ${command.description}`
										}
										isActive={command.isActive}
										isDisabled={command.disabled}
										onClick={() => handleCommandSelect(command)}
										title={
											command.disabled ? (command.disabledReason ?? command.label) : command.label
										}
									>
										{command.label}
									</CommandRow>
								))}
							</div>
							{props.activeModeControls && (
								<div className="mt-2 rounded-lg border border-zinc-200/80 p-2 dark:border-zinc-700/80">
									{props.activeModeControls}
								</div>
							)}
						</div>
						{settingCommands.length > 0 && (
							<div>
								<SectionLabel>Settings</SectionLabel>
								<div className="space-y-1">
									{settingCommands.map((command) => (
										<CommandRow
											key={command.id}
											icon={command.icon}
											description={`/${command.command} - ${command.description}`}
											isActive={command.isActive}
											isDisabled={command.disabled}
											onClick={() => handleCommandSelect(command)}
											title={
												command.disabled ? (command.disabledReason ?? command.label) : command.label
											}
										>
											{command.label}
										</CommandRow>
									))}
								</div>
							</div>
						)}
						{canUseAgents && (
							<div>
								<SectionLabel>Recipes, apps, and agents</SectionLabel>
								<div className="space-y-1">
									{isLoadingAgents ? (
										<div className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
											<span>Loading recipes, apps, and agents...</span>
										</div>
									) : actionItems.length === 0 ? (
										<div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
											No recipes, apps, or agents available.
										</div>
									) : (
										groupActionItems(actionItems).map((group) => (
											<div key={group.label} className="space-y-1">
												<SectionLabel>{group.label}</SectionLabel>
												{group.items.map((item) => (
													<CommandRow
														key={item.id}
														icon={<ActionItemAvatar item={item} />}
														description={describeActionItem(item)}
														isActive={item.id === `agent:${selectedAgent?.id}`}
														onClick={() => handleActionItemSelect(item)}
														title={item.label}
													>
														{item.label}
													</CommandRow>
												))}
											</div>
										))
									)}
								</div>
							</div>
						)}
					</div>
				</div>
				<div className="mt-3 flex items-center gap-2 border-t border-zinc-200 px-3 pt-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
					<Search className="h-3.5 w-3.5" aria-hidden="true" />
					<span>Type / for actions or @ for recipes, apps, agents, connectors, and tools.</span>
				</div>
			</PopoverContent>
		</Popover>
	);
}
