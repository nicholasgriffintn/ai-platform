import {
	Check,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Clock,
	GitBranch,
	ListTodo,
	MessageSquareText,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import { Checkbox, Input } from "~/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
	parseSandboxPromptStrategy,
	sandboxPromptStrategyOptions,
} from "~/lib/sandbox/prompt-strategies";
import { cn } from "~/lib/utils";
import {
	SANDBOX_TASK_TYPES,
	SANDBOX_TIMEOUT_DEFAULT_SECONDS,
	SANDBOX_TIMEOUT_MAX_SECONDS,
	SANDBOX_TIMEOUT_MIN_SECONDS,
	type SandboxPromptStrategy,
	type SandboxTaskType,
} from "~/types/sandbox";

const SANDBOX_TASK_TYPE_LABELS: Record<SandboxTaskType, string> = {
	"feature-implementation": "Feature implementation",
	"code-review": "Code review",
	"test-suite": "Test suite",
	"bug-fix": "Bug fix",
	refactoring: "Refactoring",
	documentation: "Documentation",
	migration: "Migration",
};

function parseSandboxTaskType(value: string): SandboxTaskType {
	return SANDBOX_TASK_TYPES.find((type) => type === value) ?? "feature-implementation";
}

interface SandboxRepoOption {
	key: string;
	repo: string;
	installationId: number;
	isConfigured: boolean;
}

interface SandboxChatModeControlsProps {
	selectedRepoKey: string;
	setSelectedRepoKey: (key: string) => void;
	repoOptions: SandboxRepoOption[];
	normalisedRepo: string;
	taskType: SandboxTaskType;
	setTaskType: (type: SandboxTaskType) => void;
	promptStrategy: SandboxPromptStrategy;
	setPromptStrategy: (strategy: SandboxPromptStrategy) => void;
	timeoutSecondsInput: string;
	setTimeoutSecondsInput: (value: string) => void;
	hasValidTimeout: boolean;
	shouldCommit: boolean;
	setShouldCommit: (value: boolean) => void;
	isReadOnlyTaskType: boolean;
	hasConnection: boolean;
	isLoadingRepos?: boolean;
	canSaveRepo?: boolean;
	isSavingRepo?: boolean;
	onSaveRepo?: () => void;
}

interface InlineSandboxControlProps {
	id: string;
	label: string;
	icon: ReactNode;
	displayLabel: string;
	isDisabled?: boolean;
	children: (close: () => void) => ReactNode;
}

function InlineSandboxControl({
	id,
	label,
	icon,
	displayLabel,
	isDisabled = false,
	children,
}: InlineSandboxControlProps) {
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
					<span className="hidden max-w-[150px] truncate lg:inline" title={displayLabel}>
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
				className="w-64 border-zinc-200 bg-off-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
			>
				<div
					id={id}
					className="px-2 py-1.5 text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400"
				>
					{label}
				</div>
				{children(() => setIsOpen(false))}
			</PopoverContent>
		</Popover>
	);
}

export function SandboxChatModeControls({
	selectedRepoKey,
	setSelectedRepoKey,
	repoOptions,
	normalisedRepo,
	taskType,
	setTaskType,
	promptStrategy,
	setPromptStrategy,
	timeoutSecondsInput,
	setTimeoutSecondsInput,
	hasValidTimeout,
	shouldCommit,
	setShouldCommit,
	isReadOnlyTaskType,
	hasConnection,
	isLoadingRepos = false,
	canSaveRepo = false,
	isSavingRepo = false,
	onSaveRepo,
}: SandboxChatModeControlsProps) {
	const [isExpanded, setIsExpanded] = useState(true);
	const hasRepoOptions = repoOptions.length > 0;
	const selectedRepoOption = repoOptions.find((option) => option.key === selectedRepoKey);
	const taskLabel = SANDBOX_TASK_TYPE_LABELS[taskType];
	const promptLabel =
		sandboxPromptStrategyOptions.find((option) => option.value === promptStrategy)?.label ?? "Auto";
	const timeoutLabel = hasValidTimeout
		? `${timeoutSecondsInput.trim() || SANDBOX_TIMEOUT_DEFAULT_SECONDS}s`
		: "Invalid timeout";

	return (
		<div className="space-y-2">
			<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
				<button
					type="button"
					onClick={() => setIsExpanded((value) => !value)}
					className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
					aria-expanded={isExpanded}
				>
					{isExpanded ? (
						<ChevronDown className="h-4 w-4 shrink-0" />
					) : (
						<ChevronRight className="h-4 w-4 shrink-0" />
					)}
					<GitBranch className="h-4 w-4 shrink-0" />
					<span>Sandbox</span>
					<span className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
						{normalisedRepo || (isLoadingRepos ? "Loading repositories" : "No repository")}
					</span>
				</button>
				{!hasConnection && (
					<Link
						to="/profile?tab=sandbox"
						className="rounded px-2 py-1 text-xs text-zinc-600 no-underline hover:bg-off-white-highlight dark:text-zinc-400 dark:hover:bg-zinc-900"
					>
						Connect GitHub
					</Link>
				)}
			</div>
			{isExpanded && (
				<>
					<div className="flex flex-wrap items-center gap-1">
						<InlineSandboxControl
							id="sandbox-repo-control"
							label="Repository"
							icon={<GitBranch className="h-4 w-4" />}
							displayLabel={
								normalisedRepo || (isLoadingRepos ? "Loading repositories" : "No repository")
							}
							isDisabled={!hasRepoOptions}
						>
							{(close) => (
								<div role="menu" aria-labelledby="sandbox-repo-control" className="space-y-1">
									{hasRepoOptions ? (
										repoOptions.map((option) => {
											const isSelected = option.key === selectedRepoKey;
											return (
												<button
													key={option.key}
													type="button"
													role="menuitemradio"
													aria-checked={isSelected}
													onClick={() => {
														setSelectedRepoKey(option.key);
														close();
													}}
													className={cn(
														"flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
														isSelected && "bg-zinc-100 font-medium dark:bg-zinc-800",
													)}
												>
													<span className="min-w-0 truncate">{option.repo}</span>
													{isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
												</button>
											);
										})
									) : (
										<div className="px-2 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
											{hasConnection ? "No repositories available" : "Connect GitHub first"}
										</div>
									)}
									{canSaveRepo && onSaveRepo && selectedRepoOption && (
										<button
											type="button"
											onClick={onSaveRepo}
											disabled={isSavingRepo}
											className="mt-1 w-full rounded border border-zinc-200 px-2 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
										>
											{isSavingRepo ? "Saving..." : "Add repository"}
										</button>
									)}
								</div>
							)}
						</InlineSandboxControl>
						<InlineSandboxControl
							id="sandbox-task-control"
							label="Task"
							icon={<ListTodo className="h-4 w-4" />}
							displayLabel={taskLabel}
						>
							{(close) => (
								<div role="menu" aria-labelledby="sandbox-task-control">
									{SANDBOX_TASK_TYPES.map((type) => {
										const isSelected = type === taskType;
										return (
											<button
												key={type}
												type="button"
												role="menuitemradio"
												aria-checked={isSelected}
												onClick={() => {
													setTaskType(parseSandboxTaskType(type));
													close();
												}}
												className={cn(
													"flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
													isSelected && "bg-zinc-100 font-medium dark:bg-zinc-800",
												)}
											>
												<span>{SANDBOX_TASK_TYPE_LABELS[type]}</span>
												{isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
											</button>
										);
									})}
								</div>
							)}
						</InlineSandboxControl>
						<InlineSandboxControl
							id="sandbox-prompt-control"
							label="Prompt"
							icon={<MessageSquareText className="h-4 w-4" />}
							displayLabel={promptLabel}
						>
							{(close) => (
								<div role="menu" aria-labelledby="sandbox-prompt-control">
									{sandboxPromptStrategyOptions.map((option) => {
										const isSelected = option.value === promptStrategy;
										return (
											<button
												key={option.value}
												type="button"
												role="menuitemradio"
												aria-checked={isSelected}
												onClick={() => {
													setPromptStrategy(parseSandboxPromptStrategy(option.value));
													close();
												}}
												className={cn(
													"flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
													isSelected && "bg-zinc-100 font-medium dark:bg-zinc-800",
												)}
											>
												<span>{option.label}</span>
												{isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
											</button>
										);
									})}
								</div>
							)}
						</InlineSandboxControl>
						<InlineSandboxControl
							id="sandbox-timeout-control"
							label="Timeout"
							icon={<Clock className="h-4 w-4" />}
							displayLabel={timeoutLabel}
						>
							{() => (
								<div className="space-y-2 px-2 pb-2">
									<Input
										id="sandbox-timeout-input"
										type="number"
										min={SANDBOX_TIMEOUT_MIN_SECONDS}
										max={SANDBOX_TIMEOUT_MAX_SECONDS}
										step={1}
										value={timeoutSecondsInput}
										onChange={(event) => setTimeoutSecondsInput(event.target.value)}
										placeholder={String(SANDBOX_TIMEOUT_DEFAULT_SECONDS)}
										className="h-8 px-2 text-xs"
									/>
									<label className="flex h-8 items-center gap-2 rounded-md text-xs text-zinc-700 dark:text-zinc-300">
										<Checkbox
											checked={shouldCommit}
											disabled={isReadOnlyTaskType}
											onCheckedChange={(checked) => setShouldCommit(Boolean(checked))}
										/>
										Commit changes
									</label>
								</div>
							)}
						</InlineSandboxControl>
					</div>
					{!hasValidTimeout && (
						<p className="text-xs text-red-600 dark:text-red-400">
							Timeout must be between {SANDBOX_TIMEOUT_MIN_SECONDS} and{" "}
							{SANDBOX_TIMEOUT_MAX_SECONDS} seconds.
						</p>
					)}
				</>
			)}
		</div>
	);
}
