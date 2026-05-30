import type {
	FineTuningJob,
	FineTuningJobEvent,
	FineTuningModelDefinition,
	StartFineTuningJobRequest,
} from "@assistant/schemas";
import { Activity, RefreshCcw } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import { Button, Card, CardContent, CardHeader, CardTitle } from "~/components/ui";
import { cn } from "~/lib/utils";
import { JobCreateForm } from "./JobCreateForm";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { formatTrainingDate, trainingRecordKey } from "./utils";

interface JobsPanelProps {
	models: FineTuningModelDefinition[];
	jobs: FineTuningJob[];
	events: FineTuningJobEvent[];
	selectedJobKey: string | null;
	isEventsLoading: boolean;
	isSubmitting: boolean;
	onSelectJob: (job: FineTuningJob) => void;
	onStartJob: (request: StartFineTuningJobRequest) => Promise<void>;
	onRefresh: () => void;
}

export function JobsPanel({
	models,
	jobs,
	events,
	selectedJobKey,
	isEventsLoading,
	isSubmitting,
	onSelectJob,
	onStartJob,
	onRefresh,
}: JobsPanelProps) {
	const selectedJob = jobs.find((job) => trainingRecordKey(job) === selectedJobKey) ?? null;

	return (
		<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
			<div className="space-y-6">
				<Card className="shadow-none">
					<CardHeader>
						<CardTitle>Create job</CardTitle>
					</CardHeader>
					<CardContent>
						<JobCreateForm models={models} isSubmitting={isSubmitting} onSubmit={onStartJob} />
					</CardContent>
				</Card>

				<Card className="shadow-none">
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle>Jobs</CardTitle>
						<Button
							variant="secondary"
							size="sm"
							icon={<RefreshCcw className="h-4 w-4" />}
							onClick={onRefresh}
						>
							Refresh
						</Button>
					</CardHeader>
					<CardContent>
						{jobs.length > 0 ? (
							<div className="space-y-2">
								{jobs.map((job) => {
									const key = trainingRecordKey(job);
									return (
										<button
											type="button"
											key={key}
											onClick={() => onSelectJob(job)}
											className={cn(
												"w-full rounded-md border p-3 text-left transition-colors",
												selectedJobKey === key
													? "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30"
													: "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
											)}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
														{job.jobName}
													</div>
													<div className="text-xs text-zinc-500 dark:text-zinc-400">
														{job.provider} · {job.modelId}
													</div>
												</div>
												<TrainingStatusBadge status={job.status} />
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<EmptyState
								icon={<Activity className="h-8 w-8 text-zinc-400" />}
								title="No jobs yet"
								message="Start a fine-tuning job and it will appear here."
							/>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="shadow-none h-fit">
				<CardHeader>
					<CardTitle>Logs</CardTitle>
				</CardHeader>
				<CardContent>
					{selectedJob ? (
						<div className="space-y-4">
							<div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="font-medium">{selectedJob.jobName}</div>
										<div className="text-xs text-zinc-500 dark:text-zinc-400">
											Created {formatTrainingDate(selectedJob.createdAt)}
										</div>
									</div>
									<TrainingStatusBadge status={selectedJob.status} />
								</div>
							</div>

							{isEventsLoading ? (
								<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading logs...</p>
							) : events.length > 0 ? (
								<div className="space-y-2">
									{events.map((event) => (
										<div
											key={event.id}
											className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3"
										>
											<div className="flex items-center justify-between gap-3 text-xs">
												<span className="uppercase tracking-wide text-zinc-500">{event.level}</span>
												<span className="text-zinc-500">{formatTrainingDate(event.createdAt)}</span>
											</div>
											<p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
												{event.message}
											</p>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-zinc-500 dark:text-zinc-400">
									No log events recorded for this job.
								</p>
							)}
						</div>
					) : (
						<p className="text-sm text-zinc-500 dark:text-zinc-400">
							Select a job to inspect its stored events.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
