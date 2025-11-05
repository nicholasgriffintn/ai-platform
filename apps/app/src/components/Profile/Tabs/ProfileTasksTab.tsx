import { Loader2 } from "lucide-react";
import type { Task } from "@assistant/schemas";

import { EmptyState } from "~/components/Core/EmptyState";
import { ListItem } from "~/components/ui";
import { Card } from "~/components/ui/Card";
import { useTasks } from "~/hooks/useTasks";
import { PageHeader } from "../../Core/PageHeader";
import { PageTitle } from "../../Core/PageTitle";
import { formatDate } from "~/lib/dates";
import { getStatusIcon } from "~/components/ui/Status/icons";

function TaskItem({ task }: { task: Task }) {
	const getTaskLabel = (task: Task): string => {
		switch (task.task_type) {
			case "memory_synthesis":
				return "Memory Synthesis";
			case "research_polling":
				return "Research Polling";
			case "replicate_polling":
				return "Replicate Polling";
			case "async_message_polling":
				return "Async Message Polling";
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

export function ProfileTasksTab() {
	const { tasks, isLoadingTasks } = useTasks({
		shouldRefetch: true,
	});

	return (
		<div>
			<PageHeader>
				<PageTitle title="Tasks" />
			</PageHeader>

			<div className="space-y-8">
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
			</div>
		</div>
	);
}
