import type {
	FinetuneWorkerDeployModelRequest,
	FinetuneWorkerStartJobRequest,
	FineTunedDeployment,
	FineTuningJob,
	FineTuningProviderId,
} from "@assistant/schemas";

import { createFineTuneProvider } from "../providers/registry.js";
import type { Env } from "../types/env.js";
import { getErrorMessage } from "../utils/errors.js";
import { HttpError } from "../utils/http.js";
import { getSageMakerDeploymentNames } from "../utils/sagemakerDeploymentNames.js";
import { requireTrainingResourceName } from "../utils/trainingNames.js";
import { TrainingStore } from "../lib/TrainingStore.js";
import { mergeFineTunedDeployment, mergeTrainingJob } from "../lib/trainingRecords.js";

type UserScopedStartJobRequest = FinetuneWorkerStartJobRequest & { userId: number };
type UserScopedDeployModelRequest = FinetuneWorkerDeployModelRequest & { userId: number };

export class TrainingWorkerService {
	private readonly store: TrainingStore;

	constructor(private readonly env: Env) {
		this.store = new TrainingStore(env.DB);
	}

	async startJob(request: UserScopedStartJobRequest): Promise<FineTuningJob> {
		const jobName = requireTrainingResourceName(
			request.jobName || `${request.model.id}-${Date.now()}`,
		);
		const trainingDataS3Uri = request.dataset.trainS3Uri;

		if (!trainingDataS3Uri) {
			throw new HttpError("Fine-tuning requires an exported S3 training dataset", 400);
		}

		await this.store.addEvent({
			provider: request.provider,
			jobName,
			level: "info",
			message: "Fine-tuning job requested",
			metadata: { modelId: request.model.id, requestId: request.requestId },
		});

		try {
			const provider = createFineTuneProvider(request.provider, { env: this.env });
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
				message: "Fine-tuning job submitted",
				metadata: result.metadata,
			});

			return result.job;
		} catch (error) {
			const failedJob: FineTuningJob = {
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
				message: "Fine-tuning job failed before submission",
				metadata: { error: failedJob.failureReason, requestId: request.requestId },
			});

			throw error;
		}
	}

	async getJob(
		providerId: FineTuningProviderId,
		jobName: string,
		userId: number,
	): Promise<FineTuningJob> {
		const stored = await this.store.getJob(providerId, jobName, userId);
		if (!stored) {
			throw new HttpError("Fine-tuning job not found", 404);
		}

		const provider = createFineTuneProvider(providerId, { env: this.env });

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
					message: "Returned cached fine-tuning job after provider status lookup failed",
					metadata: { error: getErrorMessage(error) },
				});

				return stored;
			}

			throw error;
		}
	}

	async listJobs(userId: number): Promise<FineTuningJob[]> {
		return this.store.listJobs(userId);
	}

	async listEvents(providerId: FineTuningProviderId, jobName: string, userId: number) {
		const stored = await this.store.getJob(providerId, jobName, userId);
		if (!stored) {
			throw new HttpError("Fine-tuning job not found", 404);
		}

		return this.store.listEvents(providerId, jobName);
	}

	async deployModel(request: UserScopedDeployModelRequest): Promise<FineTunedDeployment> {
		const provider = createFineTuneProvider(request.provider, { env: this.env });
		if (!provider.deployModel) {
			throw new HttpError(`Provider ${request.provider} does not support deployments`, 400);
		}

		let sourceJob: FineTuningJob | null = null;
		if (request.trainingJobName) {
			sourceJob = await this.store.getJob(
				request.provider,
				request.trainingJobName,
				request.userId,
			);
			if (!sourceJob) {
				throw new HttpError("Fine-tuning job not found", 404);
			}
		}

		const deploymentName = requireTrainingResourceName(
			request.deploymentName || `${request.model.id}-${Date.now()}`,
		);

		try {
			const result = await provider.deployModel({
				model: request.model,
				trainingJobName: request.trainingJobName,
				modelArtifactsS3Uri: request.modelArtifactsS3Uri,
				deploymentName,
				roleArn: request.roleArn,
				instanceType: request.instanceType,
				instanceCount: request.instanceCount,
				inferenceImage: request.inferenceImage,
				environment: request.environment,
			});

			await this.store.saveDeployment({
				userId: request.userId,
				deployment: result.deployment,
				request,
				response: result.deployment.providerResponse,
			});
			await this.store.addEvent({
				provider: request.provider,
				jobName: request.trainingJobName || result.deployment.endpointName,
				level: "info",
				message: "Fine-tuned model deployment submitted",
				metadata: { endpointName: result.deployment.endpointName, requestId: request.requestId },
			});

			return result.deployment;
		} catch (error) {
			const failedDeployment = this.createFailedDeployment({
				request,
				deploymentName,
				modelArtifactsS3Uri: request.modelArtifactsS3Uri || sourceJob?.modelArtifactsS3Uri,
				failureReason: getErrorMessage(error),
			});

			await this.store.saveDeployment({
				userId: request.userId,
				deployment: failedDeployment,
				request,
			});
			await this.store.addEvent({
				provider: request.provider,
				jobName: request.trainingJobName || failedDeployment.endpointName,
				level: "error",
				message: "Fine-tuned model deployment failed",
				metadata: {
					endpointName: failedDeployment.endpointName,
					error: failedDeployment.failureReason,
					requestId: request.requestId,
				},
			});

			return failedDeployment;
		}
	}

	async getDeployment(
		providerId: FineTuningProviderId,
		endpointName: string,
		userId: number,
	): Promise<FineTunedDeployment> {
		const stored = await this.store.getDeployment(providerId, endpointName, userId);
		if (!stored) {
			throw new HttpError("Fine-tuned deployment not found", 404);
		}

		const provider = createFineTuneProvider(providerId, { env: this.env });

		if (!provider.getDeployment) {
			if (!stored) {
				throw new HttpError(`Provider ${providerId} does not support deployment lookups`, 400);
			}

			return stored;
		}

		try {
			const live = await provider.getDeployment(endpointName);
			const deployment = mergeFineTunedDeployment(stored, live);
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

	async listDeployments(userId: number): Promise<FineTunedDeployment[]> {
		const deployments = await this.store.listDeployments(userId);
		return Promise.all(deployments.map((deployment) => this.refreshDeployment(deployment)));
	}

	private async refreshDeployment(stored: FineTunedDeployment): Promise<FineTunedDeployment> {
		const provider = createFineTuneProvider(stored.provider, { env: this.env });
		if (!provider.getDeployment) return stored;

		try {
			const live = await provider.getDeployment(stored.endpointName);
			const deployment = mergeFineTunedDeployment(stored, live);
			await this.store.saveDeployment({
				deployment,
				response: live.providerResponse,
			});

			if (stored.status !== deployment.status && deployment.status.toLowerCase() === "failed") {
				await this.store.addEvent({
					provider: deployment.provider,
					jobName: deployment.endpointName,
					level: "error",
					message: "Fine-tuned model deployment failed",
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
		deploymentName,
		modelArtifactsS3Uri,
		failureReason,
	}: {
		request: UserScopedDeployModelRequest;
		deploymentName: string;
		modelArtifactsS3Uri?: string;
		failureReason: string;
	}): FineTunedDeployment {
		const names = getSageMakerDeploymentNames(deploymentName);

		return {
			provider: request.provider,
			deploymentName: names.deploymentName,
			modelName: names.modelName,
			endpointConfigName: names.endpointConfigName,
			endpointName: names.endpointName,
			status: "Failed",
			modelId: request.model.id,
			modelArtifactsS3Uri,
			failureReason,
		};
	}
}
