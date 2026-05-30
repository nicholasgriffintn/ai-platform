import type {
	DeployFineTunedModelRequest,
	FineTunedDeployment,
	FineTuningJob,
	FineTuningModelDefinition,
} from "@assistant/schemas";
import { RefreshCcw, Server } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import { Button, Card, CardContent, CardHeader, CardTitle } from "~/components/ui";
import { DeploymentCreateForm } from "./DeploymentCreateForm";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { formatTrainingDate, trainingRecordKey } from "./utils";

interface DeploymentsPanelProps {
	models: FineTuningModelDefinition[];
	jobs: FineTuningJob[];
	deployments: FineTunedDeployment[];
	isSubmitting: boolean;
	onDeploy: (request: DeployFineTunedModelRequest) => Promise<void>;
	onRefresh: () => void;
}

export function DeploymentsPanel({
	models,
	jobs,
	deployments,
	isSubmitting,
	onDeploy,
	onRefresh,
}: DeploymentsPanelProps) {
	return (
		<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_1fr] gap-6">
			<Card className="shadow-none h-fit">
				<CardHeader>
					<CardTitle>Create deployment</CardTitle>
				</CardHeader>
				<CardContent>
					<DeploymentCreateForm
						models={models}
						jobs={jobs}
						isSubmitting={isSubmitting}
						onSubmit={onDeploy}
					/>
				</CardContent>
			</Card>

			<Card className="shadow-none">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Deployments</CardTitle>
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
					{deployments.length > 0 ? (
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
							{deployments.map((deployment) => (
								<div
									key={trainingRecordKey(deployment)}
									className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
												{deployment.deploymentName}
											</div>
											<div className="text-xs text-zinc-500 dark:text-zinc-400">
												{deployment.provider} · {deployment.modelId}
											</div>
										</div>
										<TrainingStatusBadge status={deployment.status} />
									</div>

									<div className="mt-4 space-y-2 text-sm">
										<div>
											<span className="text-zinc-500 dark:text-zinc-400">Endpoint</span>
											<div className="truncate text-zinc-800 dark:text-zinc-200">
												{deployment.endpointName}
											</div>
										</div>
										<div>
											<span className="text-zinc-500 dark:text-zinc-400">Model</span>
											<div className="truncate text-zinc-800 dark:text-zinc-200">
												{deployment.modelName}
											</div>
										</div>
										<div>
											<span className="text-zinc-500 dark:text-zinc-400">Created</span>
											<div className="text-zinc-800 dark:text-zinc-200">
												{formatTrainingDate(deployment.createdAt)}
											</div>
										</div>
										{deployment.modelArtifactsS3Uri && (
											<div>
												<span className="text-zinc-500 dark:text-zinc-400">Artifacts</span>
												<div className="truncate text-zinc-800 dark:text-zinc-200">
													{deployment.modelArtifactsS3Uri}
												</div>
											</div>
										)}
										{deployment.failureReason && (
											<p className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
												{deployment.failureReason}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					) : (
						<EmptyState
							icon={<Server className="h-8 w-8 text-zinc-400" />}
							title="No deployments yet"
							message="Deploy a completed SageMaker training job when model artifacts are ready."
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
