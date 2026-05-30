import type {
	TrainingWorkerDeployModelRequest,
	TrainingWorkerStartJobRequest,
	TrainingDeployment,
	TrainingDeploymentDeleteResponse,
	TrainingJob,
	TrainingProviderId,
} from "@assistant/schemas";

import { createTrainingProvider } from "../providers/registry.js";
import type { Env } from "../types/env.js";
import { getErrorMessage } from "../utils/errors.js";
import { HttpError } from "../utils/http.js";
import { getSageMakerDeploymentNames } from "../utils/sagemakerDeploymentNames.js";
import { requireTrainingResourceName } from "../utils/trainingNames.js";
import {
	getDeploymentNameInput,
	normaliseDeploymentVersion,
	withDeploymentVersion,
} from "../utils/trainingDeploymentVersions.js";
import { TrainingStore } from "../lib/TrainingStore.js";
import { mergeTrainingDeployment, mergeTrainingJob } from "../lib/trainingRecords.js";

type UserScopedStartJobRequest = TrainingWorkerStartJobRequest & { userId: number };
type UserScopedDeployModelRequest = TrainingWorkerDeployModelRequest & { userId: number };

export class TrainingWorkerService {
	private readonly store: TrainingStore;

	constructor(private readonly env: Env) {
		this.store = new TrainingStore(env.DB);
	}

	async startJob(request: UserScopedStartJobRequest): Promise<TrainingJob> {
		const jobName = requireTrainingResourceName(
			request.jobName || `${request.model.id}-${Date.now()}`,
		);
		const trainingDataS3Uri = request.dataset.trainS3Uri;

		if (!trainingDataS3Uri) {
			throw new HttpError("Training requires an exported S3 dataset", 400);
		}

		await this.store.addEvent({
			provider: request.provider,
			jobName,
			level: "info",
			message: "Training job requested",
			metadata: { modelId: request.model.id, requestId: request.requestId },
		});

		try {
			const provider = createTrainingProvider(request.provider, { env: this.env });
			const result = await provider.createTrainingJob({
				provider: request.provider,
				jobName,
				model: request.model,
				trainingDataS3Uri,
				validationDataS3Uri: request.dataset.validationS3Uri,
				customModelName: jobName,
				outputDataS3Uri: request.outputS3Uri,
				hyperParameters: request.hyperparameters,
				roleArn: request.roleArn,
				instanceType: request.instanceType,
				instanceCount: request.instanceCount,
				maxRuntimeSeconds: request.maxRuntimeSeconds,
				entryPoint: request.entryPoint,
				sourceS3Uri: request.sourceS3Uri,
				trainingImage: request.trainingImage,
			});

			await this.store.saveJob({
				userId: request.userId,
				job: result.job,
				providerJobId: result.providerJobId,
				request,
				response: result.metadata,
			});
			await this.store.addEvent({
				provider: request.provider,
				jobName,
				level: "info",
				message: "Training job submitted",
				metadata: result.metadata,
			});

			return result.job;
		} catch (error) {
			const failedJob: TrainingJob = {
				provider: request.provider,
				jobName,
				status: "Failed",
				modelId: request.model.id,
				baseModel: request.model.baseModel,
				trainingImage: request.trainingImage || request.model.trainingImage,
				trainingDataS3Uri,
				validationDataS3Uri: request.dataset.validationS3Uri,
				outputS3Uri: request.outputS3Uri,
				failureReason: getErrorMessage(error),
			};

			await this.store.saveJob({ userId: request.userId, job: failedJob, request });
			await this.store.addEvent({
				provider: request.provider,
				jobName,
				level: "error",
				message: "Training job failed before submission",
				metadata: { error: failedJob.failureReason, requestId: request.requestId },
			});

			throw error;
		}
	}

	async getJob(
		providerId: TrainingProviderId,
		jobName: string,
		userId: number,
	): Promise<TrainingJob> {
		const stored = await this.store.getJob(providerId, jobName, userId);
		if (!stored) {
			throw new HttpError("Training job not found", 404);
		}

		const provider = createTrainingProvider(providerId, { env: this.env });

		try {
			const live = await provider.getJobStatus(jobName);
			const job = mergeTrainingJob(stored, live);
			await this.store.saveJob({ job, response: live.providerResponse });

			return job;
		} catch (error) {
			if (stored) {
				await this.store.addEvent({
					provider: providerId,
					jobName,
					level: "warn",
					message: "Returned cached training job after provider status lookup failed",
					metadata: { error: getErrorMessage(error) },
				});

				return stored;
			}

			throw error;
		}
	}

	async listJobs(userId: number): Promise<TrainingJob[]> {
		return this.store.listJobs(userId);
	}

	async listEvents(providerId: TrainingProviderId, jobName: string, userId: number) {
		const stored = await this.store.getJob(providerId, jobName, userId);
		if (!stored) {
			throw new HttpError("Training job not found", 404);
		}

		return this.store.listEvents(providerId, jobName);
	}

	async deployModel(request: UserScopedDeployModelRequest): Promise<TrainingDeployment> {
		const deploymentProviderId =
			request.deploymentTarget === "bedrock-import" ? "aws-bedrock" : request.provider;
		const provider = createTrainingProvider(deploymentProviderId, { env: this.env });
		if (!provider.deployModel) {
			throw new HttpError(`Provider ${deploymentProviderId} does not support deployments`, 400);
		}

		let sourceJob: TrainingJob | null = null;
		if (request.trainingJobName) {
			sourceJob = await this.store.getJob(
				request.provider,
				request.trainingJobName,
				request.userId,
			);
			if (!sourceJob) {
				throw new HttpError("Training job not found", 404);
			}
		}

		const deploymentVersion = normaliseDeploymentVersion(request.deploymentVersion);
		const deploymentName = requireTrainingResourceName(
			getDeploymentNameInput({
				modelId: request.model.id,
				deploymentName: request.deploymentName,
				deploymentVersion,
			}),
		);

		try {
			const result = await provider.deployModel({
				model: request.model,
				trainingJobName: request.trainingJobName,
				modelArtifactsS3Uri: request.modelArtifactsS3Uri,
				deploymentName,
				deploymentTarget: request.deploymentTarget,
				roleArn: request.roleArn,
				instanceType: request.instanceType,
				instanceCount: request.instanceCount,
				serverlessMemorySizeInMB: request.serverlessMemorySizeInMB,
				serverlessMaxConcurrency: request.serverlessMaxConcurrency,
				serverlessProvisionedConcurrency: request.serverlessProvisionedConcurrency,
				inferenceImage: request.inferenceImage,
				environment: request.environment,
			});

			const deployment = withDeploymentVersion(
				{
					...result.deployment,
					deploymentTarget: result.deployment.deploymentTarget || request.deploymentTarget,
				},
				deploymentVersion,
			);

			await this.store.saveDeployment({
				userId: request.userId,
				deployment,
				request,
				response: deployment.providerResponse,
			});
			await this.store.addEvent({
				provider: deploymentProviderId,
				jobName: request.trainingJobName || deployment.endpointName,
				level: "info",
				message: "Training model deployment submitted",
				metadata: {
					endpointName: deployment.endpointName,
					deploymentVersion,
					requestId: request.requestId,
				},
			});

			return deployment;
		} catch (error) {
			const failedDeployment = this.createFailedDeployment({
				request,
				providerId: deploymentProviderId,
				deploymentName,
				deploymentVersion,
				modelArtifactsS3Uri: request.modelArtifactsS3Uri || sourceJob?.modelArtifactsS3Uri,
				failureReason: getErrorMessage(error),
			});

			await this.store.saveDeployment({
				userId: request.userId,
				deployment: failedDeployment,
				request,
			});
			await this.store.addEvent({
				provider: deploymentProviderId,
				jobName: request.trainingJobName || failedDeployment.endpointName,
				level: "error",
				message: "Training model deployment failed",
				metadata: {
					endpointName: failedDeployment.endpointName,
					deploymentVersion,
					error: failedDeployment.failureReason,
					requestId: request.requestId,
				},
			});

			return failedDeployment;
		}
	}

	async getDeployment(
		providerId: TrainingProviderId,
		endpointName: string,
		userId: number,
	): Promise<TrainingDeployment> {
		const stored = await this.store.getDeployment(providerId, endpointName, userId);
		if (!stored) {
			throw new HttpError("Training deployment not found", 404);
		}

		const provider = createTrainingProvider(providerId, { env: this.env });

		if (!provider.getDeployment) {
			if (!stored) {
				throw new HttpError(`Provider ${providerId} does not support deployment lookups`, 400);
			}

			return stored;
		}

		try {
			const live = await provider.getDeployment(endpointName);
			const deployment = mergeTrainingDeployment(stored, live);
			await this.store.saveDeployment({
				deployment,
				response: live.providerResponse,
			});

			return deployment;
		} catch (error) {
			if (stored) {
				return stored;
			}

			throw error;
		}
	}

	async listDeployments(userId: number): Promise<TrainingDeployment[]> {
		const deployments = await this.store.listDeployments(userId);
		return Promise.all(deployments.map((deployment) => this.refreshDeployment(deployment)));
	}

	async deleteDeployment(
		providerId: TrainingProviderId,
		endpointName: string,
		userId: number,
	): Promise<TrainingDeploymentDeleteResponse> {
		const stored = await this.store.getDeployment(providerId, endpointName, userId);
		if (!stored) {
			throw new HttpError("Training deployment not found", 404);
		}

		const provider = createTrainingProvider(providerId, { env: this.env });
		if (!provider.deleteDeployment) {
			throw new HttpError(`Provider ${providerId} does not support deployment deletion`, 400);
		}

		let providerDeleteError: string | undefined;
		try {
			await provider.deleteDeployment({ deployment: stored });
		} catch (error) {
			providerDeleteError = getErrorMessage(error);
			await this.store.addEvent({
				provider: providerId,
				jobName: endpointName,
				level: "warn",
				message: "Provider deployment deletion failed; stored deployment was removed",
				metadata: {
					endpointName,
					error: providerDeleteError,
				},
			});
		}

		await this.store.deleteDeployment(providerId, endpointName, userId);
		await this.store.addEvent({
			provider: providerId,
			jobName: endpointName,
			level: providerDeleteError ? "warn" : "info",
			message: providerDeleteError
				? "Training deployment removed from Polychat"
				: "Training deployment deleted",
			metadata: {
				endpointName,
				deploymentVersion: stored.deploymentVersion,
				providerDeleted: !providerDeleteError,
				error: providerDeleteError,
			},
		});

		if (providerDeleteError) {
			return {
				success: true,
				message:
					"Deployment removed from Polychat. Delete the remaining provider resources manually.",
				providerDeleted: false,
				manualDeletionRequired: true,
				error: providerDeleteError,
			};
		}

		return {
			success: true,
			message: "Deployment deleted",
			providerDeleted: true,
		};
	}

	private async refreshDeployment(stored: TrainingDeployment): Promise<TrainingDeployment> {
		const provider = createTrainingProvider(stored.provider, { env: this.env });
		if (!provider.getDeployment) return stored;

		try {
			const live = await provider.getDeployment(stored.endpointName);
			const deployment = mergeTrainingDeployment(stored, live);
			await this.store.saveDeployment({
				deployment,
				response: live.providerResponse,
			});

			if (stored.status !== deployment.status && deployment.status.toLowerCase() === "failed") {
				await this.store.addEvent({
					provider: deployment.provider,
					jobName: deployment.endpointName,
					level: "error",
					message: "Training model deployment failed",
					metadata: {
						endpointName: deployment.endpointName,
						error: deployment.failureReason,
					},
				});
			}

			return deployment;
		} catch {
			return stored;
		}
	}

	private createFailedDeployment({
		request,
		providerId,
		deploymentName,
		deploymentVersion,
		modelArtifactsS3Uri,
		failureReason,
	}: {
		request: UserScopedDeployModelRequest;
		providerId: TrainingProviderId;
		deploymentName: string;
		deploymentVersion?: string;
		modelArtifactsS3Uri?: string;
		failureReason: string;
	}): TrainingDeployment {
		const names = getSageMakerDeploymentNames(deploymentName);
		const isBedrockImport = request.deploymentTarget === "bedrock-import";

		return withDeploymentVersion(
			{
				provider: providerId,
				deploymentName: isBedrockImport ? deploymentName : names.deploymentName,
				deploymentTarget: request.deploymentTarget,
				deploymentVersion,
				modelName: isBedrockImport ? deploymentName : names.modelName,
				endpointConfigName: isBedrockImport ? deploymentName : names.endpointConfigName,
				endpointName: isBedrockImport ? deploymentName : names.endpointName,
				status: "Failed",
				modelId: request.model.id,
				modelArtifactsS3Uri,
				failureReason,
			},
			deploymentVersion,
		);
	}
}
