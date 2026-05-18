import { LoaderCircle, Pause, Play, Send, Settings2, Square } from "lucide-react";
import type { KeyboardEvent } from "react";

import { Button, Checkbox, FormSelect, Input, Label, Textarea } from "~/components/ui";
import {
	getSandboxPromptStrategyDescription,
	parseSandboxPromptStrategy,
	sandboxPromptStrategyOptions,
} from "~/lib/sandbox/prompt-strategies";
import { normaliseGitHubRepoInput } from "~/lib/sandbox/repositories";
import {
	SANDBOX_TASK_TYPES,
	SANDBOX_TIMEOUT_DEFAULT_SECONDS,
	SANDBOX_TIMEOUT_MAX_SECONDS,
	SANDBOX_TIMEOUT_MIN_SECONDS,
	type SandboxPromptStrategy,
	type SandboxTaskType,
} from "~/types/sandbox";
import { REPO_PATTERN } from "../utils";
import { SANDBOX_TASK_TYPE_DESCRIPTIONS, SANDBOX_TASK_TYPE_LABELS } from "./constants";
import { parseSandboxTaskType } from "./helpers";

interface SandboxChatComposerProps {
	repo: string;
	setRepo: (repo: string) => void;
	repoSuggestions: string[];
	normalisedRepo: string;
	model: string;
	setModel: (model: string) => void;
	taskType: SandboxTaskType;
	setTaskType: (type: SandboxTaskType) => void;
	promptStrategy: SandboxPromptStrategy;
	setPromptStrategy: (strategy: SandboxPromptStrategy) => void;
	timeoutSecondsInput: string;
	setTimeoutSecondsInput: (v: string) => void;
	hasValidTimeout: boolean;
	task: string;
	setTask: (task: string) => void;
	shouldCommit: boolean;
	setShouldCommit: (v: boolean) => void;
	isReadOnlyTaskType: boolean;
	isSubmitting: boolean;
	canSubmit: boolean;
	commandProgress: { current: number; total: number } | null;
	liveRunStatus: "running" | "paused" | undefined;
	activeRunId: string | undefined;
	instructionRunId: string | undefined;
	operatorMessage: string;
	setOperatorMessage: (message: string) => void;
	isPausePending: boolean;
	isResumePending: boolean;
	isCancelPending: boolean;
	isInstructionPending: boolean;
	onRunTask: () => void;
	onPauseRun: () => void;
	onResumeRun: () => void;
	onCancelRun: () => void;
	onSubmitInstruction: (kind: "message" | "continue") => void;
}

export function SandboxChatComposer({
	repo,
	setRepo,
	repoSuggestions,
	normalisedRepo,
	model,
	setModel,
	taskType,
	setTaskType,
	promptStrategy,
	setPromptStrategy,
	timeoutSecondsInput,
	setTimeoutSecondsInput,
	hasValidTimeout,
	task,
	setTask,
	shouldCommit,
	setShouldCommit,
	isReadOnlyTaskType,
	isSubmitting,
	canSubmit,
	commandProgress,
	liveRunStatus,
	activeRunId,
	instructionRunId,
	operatorMessage,
	setOperatorMessage,
	isPausePending,
	isResumePending,
	isCancelPending,
	isInstructionPending,
	onRunTask,
	onPauseRun,
	onResumeRun,
	onCancelRun,
	onSubmitInstruction,
}: SandboxChatComposerProps) {
	const isInstructionMode = Boolean(instructionRunId);
	const textValue = isInstructionMode ? operatorMessage : task;
	const setTextValue = isInstructionMode ? setOperatorMessage : setTask;
	const canSendInstruction =
		isInstructionMode && operatorMessage.trim().length > 0 && !isInstructionPending;

	const handleSubmit = () => {
		if (isInstructionMode) {
			onSubmitInstruction("message");
			return;
		}
		onRunTask();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		if (isInstructionMode ? canSendInstruction : canSubmit) handleSubmit();
	};

	return (
		<div
			data-sandbox-chat-composer
			className="relative rounded-lg border border-zinc-200 bg-off-white shadow-sm transition-colors focus-within:border-zinc-300 hover:border-zinc-300 dark:border-zinc-700 dark:bg-[#121212] dark:focus-within:border-zinc-500 dark:hover:border-zinc-600"
		>
			<div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-700">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
					<div className="space-y-1">
						<Label htmlFor="sandbox-repo-input">Repository</Label>
						<Input
							id="sandbox-repo-input"
							list="sandbox-repo-options"
							value={repo}
							onChange={(event) => setRepo(event.target.value)}
							onBlur={() => setRepo(normaliseGitHubRepoInput(repo))}
							placeholder="owner/repo"
							disabled={isSubmitting}
						/>
						<datalist id="sandbox-repo-options">
							{repoSuggestions.map((repository) => (
								<option key={repository} value={repository} />
							))}
						</datalist>
					</div>

					<FormSelect
						id="sandbox-task-type"
						label="Task type"
						value={taskType}
						onChange={(event) => setTaskType(parseSandboxTaskType(event.target.value))}
						disabled={isSubmitting}
						options={SANDBOX_TASK_TYPES.map((type) => ({
							value: type,
							label: SANDBOX_TASK_TYPE_LABELS[type],
						}))}
					/>

					<div className="space-y-1">
						<Label htmlFor="sandbox-model-input">Model</Label>
						<Input
							id="sandbox-model-input"
							value={model}
							onChange={(event) => setModel(event.target.value)}
							placeholder="Default sandbox model"
							disabled={isSubmitting}
						/>
					</div>
				</div>

				<details className="mt-3 group">
					<summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
						<Settings2 className="h-3.5 w-3.5" />
						Run settings
					</summary>
					<div className="mt-3 grid gap-3 md:grid-cols-2">
						<FormSelect
							id="sandbox-prompt-strategy"
							label="Prompt strategy"
							value={promptStrategy}
							onChange={(event) =>
								setPromptStrategy(parseSandboxPromptStrategy(event.target.value))
							}
							disabled={isSubmitting}
							options={sandboxPromptStrategyOptions.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
						/>
						<div className="space-y-1">
							<Label htmlFor="sandbox-timeout-input">Timeout seconds</Label>
							<Input
								id="sandbox-timeout-input"
								type="number"
								min={SANDBOX_TIMEOUT_MIN_SECONDS}
								max={SANDBOX_TIMEOUT_MAX_SECONDS}
								step={1}
								value={timeoutSecondsInput}
								onChange={(event) => setTimeoutSecondsInput(event.target.value)}
								placeholder={String(SANDBOX_TIMEOUT_DEFAULT_SECONDS)}
								disabled={isSubmitting}
							/>
						</div>
						<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
							<Checkbox
								checked={shouldCommit}
								disabled={isReadOnlyTaskType || isSubmitting}
								onCheckedChange={(checked) => setShouldCommit(Boolean(checked))}
							/>
							Commit changes
						</label>
						<div className="text-xs text-zinc-500 dark:text-zinc-400">
							{SANDBOX_TASK_TYPE_DESCRIPTIONS[taskType]}{" "}
							{getSandboxPromptStrategyDescription(promptStrategy)}
						</div>
					</div>
				</details>

				{repo.trim() && !REPO_PATTERN.test(normalisedRepo) && (
					<p className="mt-2 text-xs text-red-600 dark:text-red-400">
						Repository must use owner/repo format or a GitHub repo URL.
					</p>
				)}
				{!hasValidTimeout && (
					<p className="mt-2 text-xs text-red-600 dark:text-red-400">
						Timeout must be between {SANDBOX_TIMEOUT_MIN_SECONDS} and {SANDBOX_TIMEOUT_MAX_SECONDS}{" "}
						seconds.
					</p>
				)}
			</div>

			{isSubmitting && commandProgress && (
				<div className="border-b border-blue-200/80 bg-blue-50/60 px-3 py-2 dark:border-blue-800/50 dark:bg-blue-950/20">
					<div className="mb-1 flex items-center justify-between text-xs text-blue-900 dark:text-blue-100">
						<span className="font-medium">Executing commands</span>
						<span>
							{commandProgress.current} / {commandProgress.total}
						</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200/50 dark:bg-blue-900/30">
						<div
							className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
							style={{ width: `${(commandProgress.current / commandProgress.total) * 100}%` }}
						/>
					</div>
				</div>
			)}

			<div className="flex items-start">
				<Textarea
					id="sandbox-chat-input"
					rows={1}
					value={textValue}
					onChange={(event) => setTextValue(event.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={
						isInstructionMode
							? "Message the running sandbox agent..."
							: "Ask the sandbox agent to implement, review, test, or fix something..."
					}
					className="min-h-[72px] max-h-[220px] flex-grow resize-none border-0 bg-transparent px-4 py-3 text-base focus-visible:ring-0"
				/>
				<div className="flex flex-shrink-0 items-center gap-1 pr-3 pt-3">
					{isSubmitting && (
						<>
							{liveRunStatus === "paused" ? (
								<Button
									type="button"
									variant="icon"
									title="Resume run"
									aria-label="Resume run"
									icon={<Play className="h-5 w-5" />}
									onClick={onResumeRun}
									isLoading={isResumePending}
									disabled={!activeRunId}
								/>
							) : (
								<Button
									type="button"
									variant="icon"
									title="Pause run"
									aria-label="Pause run"
									icon={<Pause className="h-5 w-5" />}
									onClick={onPauseRun}
									isLoading={isPausePending}
									disabled={!activeRunId}
								/>
							)}
							<Button
								type="button"
								variant="icon"
								title="Cancel run"
								aria-label="Cancel run"
								icon={<Square className="h-5 w-5" />}
								onClick={onCancelRun}
								isLoading={isCancelPending}
							/>
						</>
					)}
					{isInstructionMode && (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={() => onSubmitInstruction("continue")}
							isLoading={isInstructionPending}
						>
							Continue
						</Button>
					)}
					<Button
						type="button"
						onClick={handleSubmit}
						disabled={isInstructionMode ? !canSendInstruction : !canSubmit}
						className="rounded-md bg-black p-2.5 text-white shadow-sm hover:bg-zinc-800 dark:bg-off-white dark:text-black dark:hover:bg-zinc-200"
						title={isInstructionMode ? "Send message" : "Run task"}
						aria-label={isInstructionMode ? "Send message" : "Run task"}
					>
						{isSubmitting && !isInstructionMode ? (
							<LoaderCircle className="h-5 w-5 animate-spin" />
						) : (
							<Send className="h-5 w-5" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
