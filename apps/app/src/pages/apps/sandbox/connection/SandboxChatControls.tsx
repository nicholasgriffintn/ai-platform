import { GitBranch } from "lucide-react";

import { Checkbox, FormSelect, Input, Label } from "~/components/ui";
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
import { SANDBOX_TASK_TYPE_LABELS } from "./constants";
import { parseSandboxTaskType } from "./helpers";

interface SandboxChatControlsProps {
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
	setTimeoutSecondsInput: (value: string) => void;
	hasValidTimeout: boolean;
	shouldCommit: boolean;
	setShouldCommit: (value: boolean) => void;
	isReadOnlyTaskType: boolean;
	disabled?: boolean;
}

export function SandboxChatControls({
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
	shouldCommit,
	setShouldCommit,
	isReadOnlyTaskType,
	disabled,
}: SandboxChatControlsProps) {
	return (
		<div className="space-y-3">
			<div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
				<GitBranch className="h-4 w-4 shrink-0" />
				<span>Sandbox</span>
				<span className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
					{normalisedRepo || "Choose repository"}
				</span>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<Label htmlFor="sandbox-repo-input">Repository</Label>
					<Input
						id="sandbox-repo-input"
						list="sandbox-repo-options"
						value={repo}
						onChange={(event) => setRepo(event.target.value)}
						onBlur={() => setRepo(normaliseGitHubRepoInput(repo))}
						placeholder="owner/repo"
						disabled={disabled}
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
					disabled={disabled}
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
						disabled={disabled}
					/>
				</div>
				<FormSelect
					id="sandbox-prompt-strategy"
					label="Prompt strategy"
					value={promptStrategy}
					onChange={(event) => setPromptStrategy(parseSandboxPromptStrategy(event.target.value))}
					disabled={disabled}
					options={sandboxPromptStrategyOptions.map((option) => ({
						value: option.value,
						label: option.label,
					}))}
				/>
			</div>
			<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
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
						disabled={disabled}
					/>
				</div>
				<label className="flex items-end gap-2 pb-2 text-sm text-zinc-700 dark:text-zinc-300">
					<Checkbox
						checked={shouldCommit}
						disabled={disabled || isReadOnlyTaskType}
						onCheckedChange={(checked) => setShouldCommit(Boolean(checked))}
					/>
					Commit changes
				</label>
			</div>
			{repo.trim() && !REPO_PATTERN.test(normalisedRepo) && (
				<p className="text-xs text-red-600 dark:text-red-400">
					Repository must use owner/repo format or a GitHub repo URL.
				</p>
			)}
			{!hasValidTimeout && (
				<p className="text-xs text-red-600 dark:text-red-400">
					Timeout must be between {SANDBOX_TIMEOUT_MIN_SECONDS} and {SANDBOX_TIMEOUT_MAX_SECONDS}{" "}
					seconds.
				</p>
			)}
			<p className="text-xs text-zinc-500 dark:text-zinc-400">
				{getSandboxPromptStrategyDescription(promptStrategy)}
			</p>
		</div>
	);
}
