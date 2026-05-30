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
import { requireTrainingResourceName } from "../utils/trainingNames.js";
import { TrainingStore } from "../lib/TrainingStore.js";
import { mergeFineTunedDeployment, mergeTrainingJob } from "../lib/trainingRecords.js";

export class TrainingWorkerService {
	private readonly store: TrainingStore;

	constructor(private readonly env: Env) {
		this.store = new TrainingStore(env.DB);
	}

	async startJob(request: FinetuneWorkerStartJobRequest): Promise<FineTuningJob> {
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

	async getJob(providerId: FineTuningProviderId, jobName: string): Promise<FineTuningJob> {
		const stored = await this.store.getJob(providerId, jobName);
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

	async listJobs(userId?: number): Promise<FineTuningJob[]> {
		return this.store.listJobs(userId);
	}

	async listEvents(providerId: FineTuningProviderId, jobName: string) {
		return this.store.listEvents(providerId, jobName);
	}

	async deployModel(request: FinetuneWorkerDeployModelRequest): Promise<FineTunedDeployment> {
		const provider = createFineTuneProvider(request.provider, { env: this.env });
		if (!provider.deployModel) {
			throw new HttpError(`Provider ${request.provider} does not support deployments`, 400);
		}

		const deploymentName = requireTrainingResourceName(
			request.deploymentName || `${request.model.id}-${Date.now()}`,
		);
		const result = await provider.deployModel({
			model: request.model,
			trainingJobName: request.trainingJobName,
			modelArtifactsS3Uri: request.modelArtifactsS3Uri,
			deploymentName,
			roleArn: request.roleArn,
			instanceType: request.instanceType,
			instanceCount: request.instanceCount,
			inferenceImage: request.inferenceImage,
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
	}

	async getDeployment(
		providerId: FineTuningProviderId,
		endpointName: string,
	): Promise<FineTunedDeployment> {
		const stored = await this.store.getDeployment(providerId, endpointName);
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

	async listDeployments(userId?: number): Promise<FineTunedDeployment[]> {
		return this.store.listDeployments(userId);
	}
}
