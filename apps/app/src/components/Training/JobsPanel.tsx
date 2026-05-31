import type {
	TrainingJob,
	TrainingJobEvent,
	TrainingModelDefinition,
	StartTrainingJobRequest,
} from "@assistant/schemas";
import { Activity, FileText, RefreshCcw } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import { Button, Card, CardContent, CardHeader, CardTitle } from "~/components/ui";
import { JobCreateForm } from "./JobCreateForm";
import { TrainingLogsDialog } from "./TrainingLogsDialog";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { formatTrainingDate, trainingRecordKey } from "./utils";

interface JobsPanelProps {
	models: TrainingModelDefinition[];
	jobs: TrainingJob[];
	logsJob: TrainingJob | null;
	logEvents: TrainingJobEvent[];
	isLogEventsLoading: boolean;
	isLogEventsRefreshing: boolean;
	isSubmitting: boolean;
	onOpenLogs: (job: TrainingJob) => void;
	onCloseLogs: () => void;
	onRefreshLogs: () => void;
	onStartJob: (request: StartTrainingJobRequest) => Promise<void>;
	onRefresh: () => void;
}

export function JobsPanel({
	models,
	jobs,
	logsJob,
	logEvents,
	isLogEventsLoading,
	isLogEventsRefreshing,
	isSubmitting,
	onOpenLogs,
	onCloseLogs,
	onRefreshLogs,
	onStartJob,
	onRefresh,
}: JobsPanelProps) {
	const logsResource = logsJob
		? {
				title: logsJob.jobName,
				description: `${logsJob.provider} · ${logsJob.modelId}`,
				subtitle: `Created ${formatTrainingDate(logsJob.createdAt)}`,
				status: logsJob.status,
				failureReason: logsJob.failureReason,
			}
		: null;

	return (
		<>
			<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_1fr] gap-6">
				<Card className="shadow-none h-fit">
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
							<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
								{jobs.map((job) => {
									const key = trainingRecordKey(job);
									return (
										<div
											key={key}
											className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
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

											<div className="mt-4 space-y-2 text-sm">
												<div>
													<span className="text-zinc-500 dark:text-zinc-400">Base model</span>
													<div className="truncate text-zinc-800 dark:text-zinc-200">
														{job.baseModel}
													</div>
												</div>
												<div>
													<span className="text-zinc-500 dark:text-zinc-400">Created</span>
													<div className="text-zinc-800 dark:text-zinc-200">
														{formatTrainingDate(job.createdAt)}
													</div>
												</div>
												{job.modelArtifactsS3Uri && (
													<div>
														<span className="text-zinc-500 dark:text-zinc-400">Artifacts</span>
														<div className="truncate text-zinc-800 dark:text-zinc-200">
															{job.modelArtifactsS3Uri}
														</div>
													</div>
												)}
												{job.failureReason && (
													<p className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
														{job.failureReason}
													</p>
												)}
											</div>

											<div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
												<Button
													variant="ghost"
													size="sm"
													icon={<FileText className="h-4 w-4" />}
													onClick={() => onOpenLogs(job)}
												>
													Logs
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<EmptyState
								icon={<Activity className="h-8 w-8 text-zinc-400" />}
								title="No jobs yet"
								message="Start a training job and it will appear here."
							/>
						)}
					</CardContent>
				</Card>
			</div>

			<TrainingLogsDialog
				resource={logsResource}
				events={logEvents}
				emptyMessage="No log events recorded for this job."
				isLoading={isLogEventsLoading}
				isRefreshing={isLogEventsRefreshing}
				onOpenChange={(open) => {
					if (!open) onCloseLogs();
				}}
				onRefresh={onRefreshLogs}
			/>
		</>
	);
}
