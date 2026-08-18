import {
  DeploymentsPanel,
  isActiveTrainingDeploymentStatus,
  isActiveTrainingJobStatus,
  JobsPanel,
  ModelCatalog,
  trainingRecordKey,
  TrainingSummaryBar,
} from "@ngriffin_uk/polychat-component-experiences/training";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  CardSkeleton,
} from "@ngriffin_uk/polychat-component-ui";
import type {
  DeployTrainingModelRequest,
  TrainingDeployment,
  TrainingJob,
  TrainingJobEvent,
  TrainingModelDefinition,
  StartTrainingJobRequest,
} from "@ngriffin_uk/polychat-schemas";
import { Activity, Boxes, ListChecks, Server } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import {
  useDeleteTrainingDeployment,
  useDeployTrainingModel,
  useTrainingDeploymentEvents,
  useTrainingDeployments,
  useTrainingJobEvents,
  useTrainingJobs,
  useTrainingModels,
  useStartTrainingJob,
} from "~/hooks/useTraining";
import { getErrorMessage, isAuthenticationError } from "~/lib/errors";

const EMPTY_MODELS: TrainingModelDefinition[] = [];
const EMPTY_JOBS: TrainingJob[] = [];
const EMPTY_DEPLOYMENTS: TrainingDeployment[] = [];
const EMPTY_EVENTS: TrainingJobEvent[] = [];

export function TrainingDashboard() {
  const {
    data: modelData,
    error: modelsError,
    isLoading: isModelsLoading,
    isRefetching: isModelsRefetching,
    refetch: refetchModels,
  } = useTrainingModels();
  const {
    data: jobData,
    error: jobsError,
    isLoading: isJobsLoading,
    isRefetching: isJobsRefetching,
    refetch: refetchJobs,
  } = useTrainingJobs();
  const {
    data: deploymentData,
    error: deploymentsError,
    isLoading: isDeploymentsLoading,
    isRefetching: isDeploymentsRefetching,
    refetch: refetchDeployments,
  } = useTrainingDeployments();
  const { mutateAsync: startJob, isPending: isStartingJob } = useStartTrainingJob();
  const { mutateAsync: deployModel, isPending: isDeployingModel } = useDeployTrainingModel();
  const { mutateAsync: deleteDeployment, isPending: isDeletingDeployment } =
    useDeleteTrainingDeployment();

  const models = modelData ?? EMPTY_MODELS;
  const jobs = jobData ?? EMPTY_JOBS;
  const deployments = deploymentData ?? EMPTY_DEPLOYMENTS;
  const [logsJobTarget, setLogsJobTarget] = useState<TrainingJob | null>(null);
  const [logsDeploymentTarget, setLogsDeploymentTarget] = useState<TrainingDeployment | null>(null);

  const logsJob = useMemo(() => {
    if (!logsJobTarget) {
      return null;
    }

    const logsJobKey = trainingRecordKey(logsJobTarget);

    return jobs.find((job) => trainingRecordKey(job) === logsJobKey) ?? logsJobTarget;
  }, [jobs, logsJobTarget]);
  const logsDeployment = useMemo(() => {
    if (!logsDeploymentTarget) {
      return null;
    }

    const logsDeploymentKey = trainingRecordKey(logsDeploymentTarget);

    return (
      deployments.find((deployment) => trainingRecordKey(deployment) === logsDeploymentKey) ??
      logsDeploymentTarget
    );
  }, [deployments, logsDeploymentTarget]);
  const {
    data: eventData,
    isFetching: isEventsFetching,
    isLoading: isEventsLoading,
    isRefetching: isEventsRefetching,
    refetch: refetchEvents,
  } = useTrainingJobEvents(logsJob?.provider, logsJob?.jobName, {
    enabled: Boolean(logsJob),
    refetchInterval: isActiveTrainingJobStatus(logsJob?.status) ? 10000 : false,
  });
  const {
    data: deploymentEventData,
    isFetching: isDeploymentEventsFetching,
    isLoading: isDeploymentEventsLoading,
    isRefetching: isDeploymentEventsRefetching,
    refetch: refetchDeploymentEvents,
  } = useTrainingDeploymentEvents(logsDeployment?.provider, logsDeployment?.endpointName, {
    enabled: Boolean(logsDeployment),
    refetchInterval: isActiveTrainingDeploymentStatus(logsDeployment?.status) ? 10000 : false,
  });
  const events = eventData ?? EMPTY_EVENTS;
  const deploymentEvents = deploymentEventData ?? EMPTY_EVENTS;
  const dashboardError = modelsError ?? jobsError ?? deploymentsError;
  const isLoading = isModelsLoading || isJobsLoading || isDeploymentsLoading;
  const isRefreshing =
    isModelsRefetching ||
    isJobsRefetching ||
    isDeploymentsRefetching ||
    isEventsRefetching ||
    isDeploymentEventsRefetching;

  const handleRefresh = useCallback(() => {
    void refetchModels();
    void refetchJobs();
    void refetchDeployments();
    if (logsJob) {
      void refetchEvents();
    }

    if (logsDeployment) {
      void refetchDeploymentEvents();
    }
  }, [
    logsJob,
    logsDeployment,
    refetchDeploymentEvents,
    refetchDeployments,
    refetchEvents,
    refetchJobs,
    refetchModels,
  ]);

  const handleStartJob = useCallback(
    async (request: StartTrainingJobRequest) => {
      await startJob(request);
    },
    [startJob],
  );

  const handleOpenJobLogs = useCallback((job: TrainingJob) => {
    setLogsJobTarget(job);
  }, []);

  const handleCloseJobLogs = useCallback(() => {
    setLogsJobTarget(null);
  }, []);

  const handleRefreshJobLogs = useCallback(() => {
    void refetchEvents();
  }, [refetchEvents]);

  const handleDeploy = useCallback(
    async (request: DeployTrainingModelRequest) => {
      await deployModel(request);
    },
    [deployModel],
  );

  const handleOpenDeploymentLogs = useCallback((deployment: TrainingDeployment) => {
    setLogsDeploymentTarget(deployment);
  }, []);

  const handleCloseDeploymentLogs = useCallback(() => {
    setLogsDeploymentTarget(null);
  }, []);

  const handleRefreshDeploymentLogs = useCallback(() => {
    void refetchDeploymentEvents();
  }, [refetchDeploymentEvents]);

  const handleDeleteDeployment = useCallback(
    async (deployment: TrainingDeployment) => {
      const result = await deleteDeployment({
        provider: deployment.provider,
        endpointName: deployment.endpointName,
      });

      if (logsDeployment && trainingRecordKey(logsDeployment) === trainingRecordKey(deployment)) {
        setLogsDeploymentTarget(null);
      }

      return result;
    },
    [deleteDeployment, logsDeployment],
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (dashboardError) {
    if (isAuthenticationError(dashboardError)) {
      return (
        <SignInEmptyState
          title="Sign in to view training"
          message="Sign in to access training jobs, deployments, and models."
        />
      );
    }

    return (
      <Alert variant="destructive" className="flex flex-col gap-3">
        <AlertTitle>Unable to load training data</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{getErrorMessage(dashboardError, "Unknown error occurred")}</p>
          <Button variant="primary" size="sm" onClick={handleRefresh} isLoading={isRefreshing}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TrainingSummaryBar
        modelCount={models.length}
        jobCount={jobs.length}
        deploymentCount={deployments.length}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="jobs">
            <ListChecks className="h-4 w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="deployments">
            <Server className="h-4 w-4" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="models">
            <Boxes className="h-4 w-4" />
            Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <JobsPanel
            models={models}
            jobs={jobs}
            logsJob={logsJob}
            logEvents={events}
            isLogEventsLoading={isEventsLoading || isEventsFetching}
            isLogEventsRefreshing={isEventsRefetching}
            isSubmitting={isStartingJob}
            onOpenLogs={handleOpenJobLogs}
            onCloseLogs={handleCloseJobLogs}
            onRefreshLogs={handleRefreshJobLogs}
            onStartJob={handleStartJob}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="deployments">
          <DeploymentsPanel
            models={models}
            jobs={jobs}
            deployments={deployments}
            logsDeployment={logsDeployment}
            logEvents={deploymentEvents}
            isLogEventsLoading={isDeploymentEventsLoading || isDeploymentEventsFetching}
            isLogEventsRefreshing={isDeploymentEventsRefetching}
            isSubmitting={isDeployingModel}
            isDeleting={isDeletingDeployment}
            onOpenLogs={handleOpenDeploymentLogs}
            onCloseLogs={handleCloseDeploymentLogs}
            onRefreshLogs={handleRefreshDeploymentLogs}
            onDeploy={handleDeploy}
            onDelete={handleDeleteDeployment}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="models">
          {models.length > 0 ? (
            <ModelCatalog models={models} />
          ) : (
            <EmptyState
              icon={<Activity className="h-8 w-8 text-zinc-400" />}
              title="No models configured"
              message="Add training models at the API level and they will appear here."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
