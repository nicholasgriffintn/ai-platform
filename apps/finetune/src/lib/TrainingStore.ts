import type {
	FineTunedDeployment,
	FineTuningJob,
	FineTuningJobEvent,
	FineTuningProviderId,
} from "@assistant/schemas";
import type { D1Database } from "@cloudflare/workers-types";

import {
	mapTrainingDeploymentRow,
	mapTrainingJobEventRow,
	mapTrainingJobRow,
} from "./trainingStoreRows.js";

interface SaveJobInput {
	userId?: number;
	job: FineTuningJob;
	providerJobId?: string;
	request?: unknown;
	response?: unknown;
}

interface SaveDeploymentInput {
	userId?: number;
	deployment: FineTunedDeployment;
	request?: unknown;
	response?: unknown;
}

interface AddEventInput {
	provider: FineTuningProviderId;
	jobName: string;
	level: FineTuningJobEvent["level"];
	message: string;
	metadata?: unknown;
}

export class TrainingStore {
	constructor(private readonly db: D1Database) {}

	async saveJob({ userId, job, providerJobId, request, response }: SaveJobInput): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO training_jobs (
					provider, job_name, provider_job_id, user_id, status, model_id, base_model,
					training_image, training_data_s3_uri, validation_data_s3_uri, output_s3_uri,
					model_artifacts_s3_uri, failure_reason, request_json, response_json,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				ON CONFLICT(provider, job_name) DO UPDATE SET
					provider_job_id = COALESCE(excluded.provider_job_id, training_jobs.provider_job_id),
					user_id = COALESCE(excluded.user_id, training_jobs.user_id),
					status = excluded.status,
					model_id = excluded.model_id,
					base_model = excluded.base_model,
					training_image = excluded.training_image,
					training_data_s3_uri = excluded.training_data_s3_uri,
					validation_data_s3_uri = excluded.validation_data_s3_uri,
					output_s3_uri = excluded.output_s3_uri,
					model_artifacts_s3_uri = excluded.model_artifacts_s3_uri,
					failure_reason = excluded.failure_reason,
					request_json = COALESCE(excluded.request_json, training_jobs.request_json),
					response_json = COALESCE(excluded.response_json, training_jobs.response_json),
					updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(
				job.provider,
				job.jobName,
				providerJobId ?? null,
				userId ?? null,
				job.status,
				job.modelId,
				job.baseModel,
				job.trainingImage ?? null,
				job.trainingDataS3Uri ?? null,
				job.validationDataS3Uri ?? null,
				job.outputS3Uri ?? null,
				job.modelArtifactsS3Uri ?? null,
				job.failureReason ?? null,
				request === undefined ? null : JSON.stringify(request),
				response === undefined ? null : JSON.stringify(response),
			)
			.run();
	}

	async getJob(provider: FineTuningProviderId, jobName: string): Promise<FineTuningJob | null> {
		const row = await this.db
			.prepare("SELECT * FROM training_jobs WHERE provider = ? AND job_name = ?")
			.bind(provider, jobName)
			.first<Record<string, unknown>>();
		return row ? mapTrainingJobRow(row) : null;
	}

	async listJobs(userId?: number, limit = 50): Promise<FineTuningJob[]> {
		const boundedLimit = Math.min(Math.max(limit, 1), 100);
		const statement =
			userId === undefined
				? this.db
						.prepare("SELECT * FROM training_jobs ORDER BY updated_at DESC LIMIT ?")
						.bind(boundedLimit)
				: this.db
						.prepare(
							"SELECT * FROM training_jobs WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
						)
						.bind(userId, boundedLimit);
		const result = await statement.all<Record<string, unknown>>();
		return (result.results ?? []).map(mapTrainingJobRow);
	}

	async saveDeployment({
		userId,
		deployment,
		request,
		response,
	}: SaveDeploymentInput): Promise<void> {
		await this.db
			.prepare(
				`INSERT INTO training_deployments (
					provider, endpoint_name, deployment_name, model_name, endpoint_config_name,
					user_id, status, model_id, model_artifacts_s3_uri, failure_reason,
					request_json, response_json, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				ON CONFLICT(provider, endpoint_name) DO UPDATE SET
					deployment_name = excluded.deployment_name,
					model_name = excluded.model_name,
					endpoint_config_name = excluded.endpoint_config_name,
					user_id = COALESCE(excluded.user_id, training_deployments.user_id),
					status = excluded.status,
					model_id = excluded.model_id,
					model_artifacts_s3_uri = excluded.model_artifacts_s3_uri,
					failure_reason = excluded.failure_reason,
					request_json = COALESCE(excluded.request_json, training_deployments.request_json),
					response_json = COALESCE(excluded.response_json, training_deployments.response_json),
					updated_at = CURRENT_TIMESTAMP`,
			)
			.bind(
				deployment.provider,
				deployment.endpointName,
				deployment.deploymentName,
				deployment.modelName,
				deployment.endpointConfigName,
				userId ?? null,
				deployment.status,
				deployment.modelId,
				deployment.modelArtifactsS3Uri ?? null,
				deployment.failureReason ?? null,
				request === undefined ? null : JSON.stringify(request),
				response === undefined ? null : JSON.stringify(response),
			)
			.run();
	}

	async getDeployment(
		provider: FineTuningProviderId,
		endpointName: string,
	): Promise<FineTunedDeployment | null> {
		const row = await this.db
			.prepare("SELECT * FROM training_deployments WHERE provider = ? AND endpoint_name = ?")
			.bind(provider, endpointName)
			.first<Record<string, unknown>>();
		return row ? mapTrainingDeploymentRow(row) : null;
	}

	async listDeployments(userId?: number, limit = 50): Promise<FineTunedDeployment[]> {
		const boundedLimit = Math.min(Math.max(limit, 1), 100);
		const statement =
			userId === undefined
				? this.db
						.prepare("SELECT * FROM training_deployments ORDER BY updated_at DESC LIMIT ?")
						.bind(boundedLimit)
				: this.db
						.prepare(
							"SELECT * FROM training_deployments WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
						)
						.bind(userId, boundedLimit);
		const result = await statement.all<Record<string, unknown>>();
		return (result.results ?? []).map(mapTrainingDeploymentRow);
	}

	async addEvent(input: AddEventInput): Promise<FineTuningJobEvent> {
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();
		await this.db
			.prepare(
				`INSERT INTO training_job_events (
					id, provider, job_name, level, message, metadata_json, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				id,
				input.provider,
				input.jobName,
				input.level,
				input.message,
				input.metadata === undefined ? null : JSON.stringify(input.metadata),
				createdAt,
			)
			.run();

		return {
			id,
			provider: input.provider,
			jobName: input.jobName,
			level: input.level,
			message: input.message,
			metadata: input.metadata,
			createdAt,
		};
	}

	async listEvents(
		provider: FineTuningProviderId,
		jobName: string,
		limit = 100,
	): Promise<FineTuningJobEvent[]> {
		const result = await this.db
			.prepare(
				`SELECT * FROM training_job_events
				WHERE provider = ? AND job_name = ?
				ORDER BY created_at ASC
				LIMIT ?`,
			)
			.bind(provider, jobName, Math.min(Math.max(limit, 1), 500))
			.all<Record<string, unknown>>();
		return (result.results ?? []).map(mapTrainingJobEventRow);
	}
}
