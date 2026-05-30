import type { TrainingJobEvent } from "@assistant/schemas";
import { RefreshCcw } from "lucide-react";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { formatTrainingDate, getTrainingEventDetail } from "./utils";

interface TrainingLogsResource {
	title: string;
	description: string;
	status: string;
	subtitle?: string;
	failureReason?: string;
}

interface TrainingLogsDialogProps {
	resource: TrainingLogsResource | null;
	events: TrainingJobEvent[];
	emptyMessage: string;
	isLoading: boolean;
	isRefreshing: boolean;
	onOpenChange: (open: boolean) => void;
	onRefresh: () => void;
}

export function TrainingLogsDialog({
	resource,
	events,
	emptyMessage,
	isLoading,
	isRefreshing,
	onOpenChange,
	onRefresh,
}: TrainingLogsDialogProps) {
	if (!resource) return null;

	return (
		<Dialog open={Boolean(resource)} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Logs</DialogTitle>
					<DialogDescription>{resource.title}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="font-medium truncate">{resource.title}</div>
								<div className="text-xs text-zinc-500 dark:text-zinc-400">
									{resource.description}
								</div>
								{resource.subtitle && (
									<div className="text-xs text-zinc-500 dark:text-zinc-400">
										{resource.subtitle}
									</div>
								)}
							</div>
							<TrainingStatusBadge status={resource.status} />
						</div>
						{resource.failureReason && (
							<p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
								{resource.failureReason}
							</p>
						)}
					</div>

					<div className="flex justify-end">
						<Button
							variant="secondary"
							size="sm"
							icon={<RefreshCcw className="h-4 w-4" />}
							onClick={onRefresh}
							isLoading={isRefreshing}
						>
							Refresh
						</Button>
					</div>

					{isLoading ? (
						<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading logs...</p>
					) : events.length > 0 ? (
						<div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
							{events.map((event) => {
								const detail = getTrainingEventDetail(event);
								return (
									<div
										key={event.id}
										className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
									>
										<div className="flex items-center justify-between gap-3 text-xs">
											<span className="uppercase tracking-wide text-zinc-500">{event.level}</span>
											<span className="text-zinc-500">{formatTrainingDate(event.createdAt)}</span>
										</div>
										<p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{event.message}</p>
										{detail && (
											<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{detail}</p>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
