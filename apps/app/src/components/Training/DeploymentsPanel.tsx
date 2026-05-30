import type {
	DeployTrainingModelRequest,
	TrainingDeployment,
	TrainingDeploymentDeleteResponse,
	TrainingJob,
	TrainingModelDefinition,
} from "@assistant/schemas";
import { useState } from "react";
import { RefreshCcw, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "~/components/Core/EmptyState";
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	ConfirmationDialog,
} from "~/components/ui";
import { getErrorMessage } from "~/lib/errors";
import { DeploymentCreateForm } from "./DeploymentCreateForm";
import { TrainingStatusBadge } from "./TrainingStatusBadge";
import { formatDeploymentTarget, formatTrainingDate, trainingRecordKey } from "./utils";

interface DeploymentsPanelProps {
	models: TrainingModelDefinition[];
	jobs: TrainingJob[];
	deployments: TrainingDeployment[];
	isSubmitting: boolean;
	isDeleting: boolean;
	onDeploy: (request: DeployTrainingModelRequest) => Promise<void>;
	onDelete: (deployment: TrainingDeployment) => Promise<TrainingDeploymentDeleteResponse>;
	onRefresh: () => void;
}

export function DeploymentsPanel({
	models,
	jobs,
	deployments,
	isSubmitting,
	isDeleting,
	onDeploy,
	onDelete,
	onRefresh,
}: DeploymentsPanelProps) {
	const [deploymentToDelete, setDeploymentToDelete] = useState<TrainingDeployment | null>(null);

	const handleDelete = async () => {
		if (!deploymentToDelete) return;

		try {
			const result = await onDelete(deploymentToDelete);
			setDeploymentToDelete(null);
			if (result.manualDeletionRequired) {
				toast.warning(result.message);
			} else {
				toast.success(result.message);
			}
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to delete deployment"));
		}
	};

	return (
		<>
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
													{deployment.deploymentVersion ? ` · ${deployment.deploymentVersion}` : ""}
												</div>
												<div className="text-xs text-zinc-500 dark:text-zinc-400">
													{formatDeploymentTarget(deployment.deploymentTarget)}
												</div>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												<TrainingStatusBadge status={deployment.status} />
												<Button
													variant="ghost"
													size="sm"
													icon={<Trash2 className="h-4 w-4" />}
													onClick={() => setDeploymentToDelete(deployment)}
												>
													Delete
												</Button>
											</div>
										</div>

										<div className="mt-4 space-y-2 text-sm">
											<div>
												<span className="text-zinc-500 dark:text-zinc-400">
													{deployment.deploymentTarget === "bedrock-import"
														? "Import job"
														: "Endpoint"}
												</span>
												<div className="truncate text-zinc-800 dark:text-zinc-200">
													{deployment.endpointName}
												</div>
											</div>
											{deployment.chatModelId && (
												<div>
													<span className="text-zinc-500 dark:text-zinc-400">Chat model</span>
													<div className="truncate text-zinc-800 dark:text-zinc-200">
														{deployment.chatModelId}
													</div>
												</div>
											)}
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

			<ConfirmationDialog
				open={Boolean(deploymentToDelete)}
				onOpenChange={(open) => !open && setDeploymentToDelete(null)}
				title="Delete deployment"
				description={
					deploymentToDelete
						? `Delete ${deploymentToDelete.endpointName} and remove it from the deployment list.`
						: ""
				}
				confirmText="Delete"
				variant="destructive"
				onConfirm={handleDelete}
				isLoading={isDeleting}
			/>
		</>
	);
}
