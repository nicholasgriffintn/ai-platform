import { LoaderCircle, Pause, Play, Square } from "lucide-react";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	FormSelect,
	Input,
	Label,
	Textarea,
} from "~/components/ui";
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
import {
	SANDBOX_TASK_TYPE_DESCRIPTIONS,
	SANDBOX_TASK_TYPE_LABELS,
} from "./constants";
import { parseSandboxTaskType } from "./helpers";
import { REPO_PATTERN } from "../utils";

interface Props {
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
	isPausePending: boolean;
	isResumePending: boolean;
	isCancelPending: boolean;
	onRunTask: () => void;
	onPauseRun: () => void;
	onResumeRun: () => void;
	onCancelRun: () => void;
	appId: string;
}

export function RunTaskForm({
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
	isPausePending,
	isResumePending,
	isCancelPending,
	onRunTask,
	onPauseRun,
	onResumeRun,
	onCancelRun,
	appId,
}: Props) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Run a task</CardTitle>
				<CardDescription>
					Connected App ID {appId}. Enter a repo task and stream progress live.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 md:grid-cols-3">
					<div className="space-y-2">
						<Label htmlFor="sandbox-repo-input">Repository</Label>
						<Input
							id="sandbox-repo-input"
							list="sandbox-repo-options"
							value={repo}
							onChange={(event) => setRepo(event.target.value)}
							onBlur={() => setRepo(normaliseGitHubRepoInput(repo))}
							placeholder="owner/repo"
						/>
						<datalist id="sandbox-repo-options">
							{repoSuggestions.map((repository) => (
								<option key={repository} value={repository} />
							))}
						</datalist>
						{repo.trim() && !REPO_PATTERN.test(normalisedRepo) ? (
							<p className="text-xs text-red-600 dark:text-red-400">
								Repository must use owner/repo format (or a GitHub URL).
							</p>
						) : repoSuggestions.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No repo suggestions yet. Paste owner/repo or a GitHub repo URL
								and we will remember it for this installation.
							</p>
						) : null}
					</div>
					<div className="space-y-2">
						<Label htmlFor="sandbox-model-input">
							Model (optional override)
						</Label>
						<Input
							id="sandbox-model-input"
							value={model}
							onChange={(event) => setModel(event.target.value)}
							placeholder="e.g. mistral-large"
						/>
						<p className="text-xs text-muted-foreground">
							Leave blank to use your Sandbox model setting. If none is set,
							backend defaults to <code>mistral-large</code>.
						</p>
					</div>
					<div className="space-y-2">
						<FormSelect
							id="sandbox-task-type"
							label="Task type"
							value={taskType}
							onChange={(event) =>
								setTaskType(parseSandboxTaskType(event.target.value))
							}
							options={SANDBOX_TASK_TYPES.map((type) => ({
								value: type,
								label: SANDBOX_TASK_TYPE_LABELS[type],
							}))}
						/>
						<p className="text-xs text-muted-foreground">
							{SANDBOX_TASK_TYPE_DESCRIPTIONS[taskType]}
						</p>
					</div>
					<div className="space-y-2">
						<FormSelect
							id="sandbox-prompt-strategy"
							label="Prompt strategy"
							value={promptStrategy}
							onChange={(event) =>
								setPromptStrategy(
									parseSandboxPromptStrategy(event.target.value),
								)
							}
							options={sandboxPromptStrategyOptions.map((option) => ({
								value: option.value,
								label: option.label,
							}))}
						/>
						<p className="text-xs text-muted-foreground">
							{getSandboxPromptStrategyDescription(promptStrategy)}
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="sandbox-timeout-input">Timeout (seconds)</Label>
						<Input
							id="sandbox-timeout-input"
							type="number"
							min={SANDBOX_TIMEOUT_MIN_SECONDS}
							max={SANDBOX_TIMEOUT_MAX_SECONDS}
							step={1}
							value={timeoutSecondsInput}
							onChange={(event) => setTimeoutSecondsInput(event.target.value)}
							placeholder={String(SANDBOX_TIMEOUT_DEFAULT_SECONDS)}
						/>
						{!hasValidTimeout ? (
							<p className="text-xs text-red-600 dark:text-red-400">
								Timeout must be between {SANDBOX_TIMEOUT_MIN_SECONDS} and{" "}
								{SANDBOX_TIMEOUT_MAX_SECONDS} seconds.
							</p>
						) : (
							<p className="text-xs text-muted-foreground">
								Per-run execution timeout; the run will fail once this limit is
								reached.
							</p>
						)}
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="sandbox-task-input">Task</Label>
					<Textarea
						id="sandbox-task-input"
						rows={5}
						value={task}
						onChange={(event) => setTask(event.target.value)}
						placeholder="Implement feature X, update tests, and explain the changes."
					/>
				</div>
				{isSubmitting && commandProgress && (
					<div className="rounded-md border border-blue-200/80 bg-blue-50/50 p-3 dark:border-blue-800/50 dark:bg-blue-950/20">
						<div className="mb-2 flex items-center justify-between text-xs">
							<span className="font-medium text-blue-900 dark:text-blue-100">
								Executing commands
							</span>
							<span className="text-blue-700 dark:text-blue-300">
								{commandProgress.current} / {commandProgress.total}
							</span>
						</div>
						<div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/50 dark:bg-blue-900/30">
							<div
								className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
								style={{
									width: `${(commandProgress.current / commandProgress.total) * 100}%`,
								}}
							/>
						</div>
					</div>
				)}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
						<Checkbox
							checked={shouldCommit}
							disabled={isReadOnlyTaskType}
							onCheckedChange={(checked) => setShouldCommit(Boolean(checked))}
						/>
						{isReadOnlyTaskType
							? "Commits are disabled for read-only task types."
							: "Automatically commit changes to a new branch when the run completes"}
					</label>
					<div className="flex items-center gap-2">
						{isSubmitting && (
							<>
								{liveRunStatus === "paused" ? (
									<Button
										variant="secondary"
										icon={<Play className="h-4 w-4" />}
										onClick={onResumeRun}
										isLoading={isResumePending}
										disabled={!activeRunId}
									>
										Resume run
									</Button>
								) : (
									<Button
										variant="secondary"
										icon={<Pause className="h-4 w-4" />}
										onClick={onPauseRun}
										isLoading={isPausePending}
										disabled={!activeRunId}
									>
										Pause run
									</Button>
								)}
								<Button
									variant="secondary"
									icon={<Square className="h-4 w-4" />}
									onClick={onCancelRun}
									isLoading={isCancelPending}
								>
									Cancel run
								</Button>
							</>
						)}
						<Button
							variant="primary"
							icon={
								isSubmitting ? (
									<LoaderCircle className="h-4 w-4 animate-spin" />
								) : (
									<Play className="h-4 w-4" />
								)
							}
							onClick={onRunTask}
							disabled={!canSubmit}
						>
							{isSubmitting ? "Running..." : "Run task"}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
