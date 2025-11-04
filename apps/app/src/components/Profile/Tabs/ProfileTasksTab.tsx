import {
	Loader2,
	Play,
	Sparkles,
	History,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Task, MemorySynthesis } from "@assistant/schemas";

import { EmptyState } from "~/components/Core/EmptyState";
import { Button, ListItem } from "~/components/ui";
import { Card } from "~/components/ui/Card";
import { useTasks, useMemorySynthesis } from "~/hooks/useTasks";
import { PageHeader } from "../../Core/PageHeader";
import { PageTitle } from "../../Core/PageTitle";
import { formatDate } from "~/lib/dates";
import { getStatusIcon } from "~/components/ui/Status/icons";

function TaskItem({ task }: { task: Task }) {
	const getTaskLabel = (task: Task): string => {
		switch (task.task_type) {
			case "memory_synthesis":
				return "Memory Synthesis";
			default:
				return task.task_type;
		}
	};

	const buildSublabel = (): string => {
		let parts: string[] = [];
		parts.push(`Created: ${formatDate(task.created_at)}`);
		if (task.completed_at) {
			parts.push(`Completed: ${formatDate(task.completed_at)}`);
		}
		if (task.error_message) {
			parts.push(`Error: ${task.error_message}`);
		}
		if (task.attempts !== undefined && task.attempts > 0) {
			parts.push(`Attempts: ${task.attempts}/${task.max_attempts || 3}`);
		}
		return parts.join(" • ");
	};

	return (
		<ListItem
			icon={getStatusIcon(task.status || "pending")}
			label={`${getTaskLabel(task)} - ${task.status?.toUpperCase()}`}
			sublabel={buildSublabel()}
			className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
		/>
	);
}

function SynthesisCard({
	synthesis,
	isHistory = false,
}: {
	synthesis: MemorySynthesis;
	isHistory?: boolean;
}) {
	const [isExpanded, setIsExpanded] = useState(!isHistory);

	return (
		<div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-800">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<Sparkles size={16} className="text-purple-600" />
						<span className="font-semibold text-zinc-900 dark:text-zinc-100">
							{isHistory
								? `Version ${synthesis.synthesis_version}`
								: "Active Memory Synthesis"}
						</span>
						{!synthesis.is_active && (
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								(Superseded)
							</span>
						)}
					</div>
					<div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
						<div>Created: {formatDate(synthesis.created_at)}</div>
						<div>
							Memories: {synthesis.memory_count} |{" "}
							{synthesis.tokens_used ? `Tokens: ${synthesis.tokens_used}` : ""}
						</div>
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsExpanded(!isExpanded)}
					className="p-1"
				>
					{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</Button>
			</div>

			{isExpanded && (
				<div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
					<p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
						{synthesis.synthesis_text}
					</p>
				</div>
			)}
		</div>
	);
}

export function ProfileTasksTab() {
	const { tasks, isLoadingTasks, triggerSynthesis, isTriggeringSynthesis } =
		useTasks();
	const { synthesis, isLoadingSynthesis, history, isLoadingHistory } =
		useMemorySynthesis();

	const handleTriggerSynthesis = async () => {
		try {
			triggerSynthesis(
				{ namespace: "global" },
				{
					onSuccess: (response) => {
						toast.success(`Memory synthesis task created: ${response.task_id}`);
					},
					onError: (error) => {
						const message = `Failed to trigger synthesis: ${error.message || "Unknown error"}`;
						toast.error(message);
						console.error(message, error);
					},
				},
			);
		} catch (error) {
			console.error("Error triggering synthesis:", error);
		}
	};

	return (
		<div>
			<PageHeader>
				<PageTitle title="Tasks & Memory Synthesis" />
			</PageHeader>

			<div className="space-y-8">
				<Card>
					<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
						<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
							Memory Synthesis
						</h3>
						<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
							Consolidate your memories into a coherent summary using AI. This
							helps improve conversation context and memory retrieval.
						</p>
					</div>
					<div className="px-6 space-y-4">
						<Button
							onClick={handleTriggerSynthesis}
							variant="primary"
							disabled={isTriggeringSynthesis}
						>
							{isTriggeringSynthesis ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
									Task...
								</>
							) : (
								<>
									<Play className="mr-2 h-4 w-4" /> Trigger Memory Synthesis
								</>
							)}
						</Button>
						<p className="text-xs text-zinc-500 dark:text-zinc-400">
							Note: Memory synthesis runs automatically every day at 2 AM if you
							have 5 or more new memories.
						</p>
					</div>
				</Card>

				{synthesis && (
					<Card>
						<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								Current Memory Summary
							</h3>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								This summary is used to provide context in your conversations.
							</p>
						</div>
						<div className="px-6">
							{isLoadingSynthesis ? (
								<div className="flex items-center justify-center py-6">
									<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
								</div>
							) : (
								<SynthesisCard synthesis={synthesis} />
							)}
						</div>
					</Card>
				)}

				<Card>
					<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
						<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
							Recent Tasks
						</h3>
						<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
							View the status of your recent background tasks.
						</p>
					</div>
					<div className="px-6">
						{isLoadingTasks ? (
							<div className="flex items-center justify-center py-6">
								<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
								<span className="ml-2 text-zinc-500 dark:text-zinc-400">
									Loading tasks...
								</span>
							</div>
						) : tasks.length === 0 ? (
							<EmptyState
								message="No tasks found. Trigger a memory synthesis to get started!"
								className="bg-transparent dark:bg-transparent py-6 px-0"
							/>
						) : (
							<ul className="space-y-2">
								{tasks.slice(0, 10).map((task) => (
									<TaskItem key={task.id} task={task} />
								))}
							</ul>
						)}
					</div>
				</Card>

				{history.length > 0 && (
					<Card>
						<div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
							<div className="flex items-center gap-2">
								<History size={20} />
								<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
									Synthesis History
								</h3>
							</div>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								Previous versions of your memory synthesis.
							</p>
						</div>
						<div className="px-6">
							{isLoadingHistory ? (
								<div className="flex items-center justify-center py-6">
									<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
								</div>
							) : (
								<div className="space-y-3">
									{history.map((syn) => (
										<SynthesisCard key={syn.id} synthesis={syn} isHistory />
									))}
								</div>
							)}
						</div>
					</Card>
				)}
			</div>
		</div>
	);
}
