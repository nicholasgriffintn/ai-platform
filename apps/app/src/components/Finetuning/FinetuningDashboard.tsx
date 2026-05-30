import { useCallback, useEffect, useMemo, useState } from "react";
import type {
	DeployFineTunedModelRequest,
	FineTunedDeployment,
	FineTuningJob,
	FineTuningJobEvent,
	FineTuningModelDefinition,
	StartFineTuningJobRequest,
} from "@assistant/schemas";
import { Activity, Boxes, ListChecks, RefreshCcw, Server } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Card,
	CardContent,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import {
	useDeployFineTunedModel,
	useFineTunedDeployments,
	useFineTuningJobEvents,
	useFineTuningJobs,
	useFineTuningModels,
	useStartFineTuningJob,
} from "~/hooks/useTraining";
import { getErrorMessage } from "~/lib/errors";
import { DeploymentsPanel } from "./DeploymentsPanel";
import { JobsPanel } from "./JobsPanel";
import { ModelCatalog } from "./ModelCatalog";
import { trainingRecordKey } from "./utils";

const EMPTY_MODELS: FineTuningModelDefinition[] = [];
const EMPTY_JOBS: FineTuningJob[] = [];
const EMPTY_DEPLOYMENTS: FineTunedDeployment[] = [];
const EMPTY_EVENTS: FineTuningJobEvent[] = [];

export function FinetuningDashboard() {
	const {
		data: modelData,
		error: modelsError,
		isLoading: isModelsLoading,
		isRefetching: isModelsRefetching,
		refetch: refetchModels,
	} = useFineTuningModels();
	const {
		data: jobData,
		error: jobsError,
		isLoading: isJobsLoading,
		isRefetching: isJobsRefetching,
		refetch: refetchJobs,
	} = useFineTuningJobs();
	const {
		data: deploymentData,
		error: deploymentsError,
		isLoading: isDeploymentsLoading,
		isRefetching: isDeploymentsRefetching,
		refetch: refetchDeployments,
	} = useFineTunedDeployments();
	const { mutateAsync: startJob, isPending: isStartingJob } = useStartFineTuningJob();
	const { mutateAsync: deployModel, isPending: isDeployingModel } = useDeployFineTunedModel();

	const models = modelData ?? EMPTY_MODELS;
	const jobs = jobData ?? EMPTY_JOBS;
	const deployments = deploymentData ?? EMPTY_DEPLOYMENTS;
	const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);

	useEffect(() => {
		if (jobs.length === 0) {
			if (selectedJobKey) setSelectedJobKey(null);
			return;
		}

		if (!selectedJobKey || !jobs.some((job) => trainingRecordKey(job) === selectedJobKey)) {
			const firstJob = jobs[0];
			if (firstJob) setSelectedJobKey(trainingRecordKey(firstJob));
		}
	}, [jobs, selectedJobKey]);

	const selectedJob = useMemo(
		() => jobs.find((job) => trainingRecordKey(job) === selectedJobKey) ?? null,
		[jobs, selectedJobKey],
	);

	const {
		data: eventData,
		isFetching: isEventsFetching,
		isLoading: isEventsLoading,
		isRefetching: isEventsRefetching,
		refetch: refetchEvents,
	} = useFineTuningJobEvents(selectedJob?.provider, selectedJob?.jobName);
	const events = eventData ?? EMPTY_EVENTS;
	const dashboardError = modelsError ?? jobsError ?? deploymentsError;
	const isLoading = isModelsLoading || isJobsLoading || isDeploymentsLoading;
	const isRefreshing =
		isModelsRefetching || isJobsRefetching || isDeploymentsRefetching || isEventsRefetching;

	const handleSelectJob = useCallback((job: FineTuningJob) => {
		setSelectedJobKey(trainingRecordKey(job));
	}, []);

	const handleRefresh = useCallback(() => {
		void refetchModels();
		void refetchJobs();
		void refetchDeployments();
		if (selectedJob) {
			void refetchEvents();
		}
	}, [refetchDeployments, refetchEvents, refetchJobs, refetchModels, selectedJob]);

	const handleStartJob = useCallback(
		async (request: StartFineTuningJobRequest) => {
			const job = await startJob(request);
			setSelectedJobKey(trainingRecordKey(job));
			void refetchJobs();
		},
		[refetchJobs, startJob],
	);

	const handleDeploy = useCallback(
		async (request: DeployFineTunedModelRequest) => {
			await deployModel(request);
			void refetchDeployments();
		},
		[deployModel, refetchDeployments],
	);

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<CardSkeleton count={3} />
			</div>
		);
	}

	if (dashboardError) {
		return (
			<Alert variant="destructive" className="flex flex-col gap-3">
				<AlertTitle>Unable to load fine-tuning data</AlertTitle>
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
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1">
					<SummaryCard label="Models" value={models.length} />
					<SummaryCard label="Jobs" value={jobs.length} />
					<SummaryCard label="Deployments" value={deployments.length} />
				</div>
				<Button
					variant="secondary"
					size="sm"
					icon={<RefreshCcw className="h-4 w-4" />}
					onClick={handleRefresh}
					isLoading={isRefreshing}
				>
					Refresh
				</Button>
			</div>

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
						events={events}
						selectedJobKey={selectedJobKey}
						isEventsLoading={isEventsLoading || isEventsFetching}
						isSubmitting={isStartingJob}
						onSelectJob={handleSelectJob}
						onStartJob={handleStartJob}
						onRefresh={handleRefresh}
					/>
				</TabsContent>

				<TabsContent value="deployments">
					<DeploymentsPanel
						models={models}
						jobs={jobs}
						deployments={deployments}
						isSubmitting={isDeployingModel}
						onDeploy={handleDeploy}
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
							message="Add fine-tuning models at the API level and they will appear here."
						/>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

interface SummaryCardProps {
	label: string;
	value: number;
}

function SummaryCard({ label, value }: SummaryCardProps) {
	return (
		<Card className="shadow-none py-4">
			<CardContent className="space-y-1">
				<div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
					{label}
				</div>
				<div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
			</CardContent>
		</Card>
	);
}
