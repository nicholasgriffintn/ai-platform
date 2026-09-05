import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  TrainingJob,
  TrainingJobEvent,
  TrainingModelDefinition,
  StartTrainingJobRequest,
} from "@ngriffin_uk/polychat-schemas";
import { Activity, FileText, RefreshCcw } from "lucide-react";

import { TrainingStatusBadge } from "./index";
import { JobCreateForm } from "./JobCreateForm";
import { TrainingLogsDialog } from "./TrainingLogsDialog";
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
                    <div key={key} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{job.jobName}</div>
                          <div className="text-xs text-muted-foreground">
                            {job.provider} · {job.modelId}
                          </div>
                        </div>
                        <TrainingStatusBadge status={job.status} />
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Base model</span>
                          <div className="truncate text-foreground">{job.baseModel}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created</span>
                          <div className="text-foreground">{formatTrainingDate(job.createdAt)}</div>
                        </div>
                        {job.modelArtifactsS3Uri && (
                          <div>
                            <span className="text-muted-foreground">Artifacts</span>
                            <div className="truncate text-foreground">
                              {job.modelArtifactsS3Uri}
                            </div>
                          </div>
                        )}
                        {job.failureReason && (
                          <p className="rounded-md bg-failure/12 p-2 text-sm text-failure">
                            {job.failureReason}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
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
                icon={<Activity className="h-8 w-8 text-muted-foreground" />}
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
          if (!open) {
            onCloseLogs();
          }
        }}
        onRefresh={onRefreshLogs}
      />
    </>
  );
}
