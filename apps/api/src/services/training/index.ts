import { getBedrockImportModelSourceUriError } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { exportTrainingExamplesToS3 } from "~/lib/providers/capabilities/training/exportDataset";
import {
	getTrainingModel,
	trainingModelCatalog,
} from "~/lib/providers/capabilities/training/modelCatalog";
import { resolveTrainingDeploymentEnvironment } from "~/lib/providers/capabilities/training/trainingDeploymentEnvironment";
import { resolveTrainingHyperparameters } from "~/lib/providers/capabilities/training/trainingHyperparameters";
import { resolveTrainingSource } from "~/lib/providers/capabilities/training/trainingSourceArchives";
import type {
	DeployTrainingModelRequest,
	TrainingDeployment,
	TrainingDeploymentDeleteResponse,
	TrainingJob,
	TrainingJobEvent,
	TrainingModelDefinition,
	TrainingProviderId,
	StartTrainingJobRequest,
} from "~/types/training";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	deployTrainingWorkerModel,
	deleteTrainingWorkerDeployment,
	getTrainingWorkerDeployment,
	getTrainingWorkerJob,
	listTrainingWorkerDeployments,
	listTrainingWorkerJobEvents,
	listTrainingWorkerJobs,
	startTrainingWorkerJob,
} from "./trainingWorkerClient";

export async function listTrainingModels(
	context: ServiceContext,
): Promise<TrainingModelDefinition[]> {
	context.requireUser();
	return trainingModelCatalog;
}

export async function startTrainingJob(
	context: ServiceContext,
	request: StartTrainingJobRequest,
): Promise<TrainingJob> {
	const user = context.requireUser();
	const model = requireTrainingModel(request.provider, request.modelId);
	let trainS3Uri = request.dataset.trainS3Uri;

	if (!trainS3Uri && request.dataset.trainingExampleFilters) {
		const exported = await exportTrainingExamplesToS3({
			context,
			filters: request.dataset.trainingExampleFilters,
		});
		trainS3Uri = exported.s3Uri;
	}

	const trainingSource = await resolveTrainingSource({
		context,
		model,
		sourceS3Uri: request.sourceS3Uri,
	});
	const hyperparameters = resolveTrainingHyperparameters({
		model,
		trainS3Uri,
		validationS3Uri: request.dataset.validationS3Uri,
		requestHyperparameters: request.hyperparameters,
	});

	return startTrainingWorkerJob(
		context.env,
		{
			...request,
			model,
			requestId: context.requestId,
			entryPoint: request.entryPoint || trainingSource.entryPoint,
			sourceS3Uri: trainingSource.sourceS3Uri,
			hyperparameters,
			dataset: {
				...request.dataset,
				trainS3Uri,
			},
		},
		user.id,
	);
}

export async function getTrainingJob(
	context: ServiceContext,
	providerId: TrainingProviderId,
	jobName: string,
): Promise<TrainingJob> {
	const user = context.requireUser();
	return getTrainingWorkerJob(context.env, providerId, jobName, user.id);
}

export async function listTrainingJobs(context: ServiceContext): Promise<TrainingJob[]> {
	const user = context.requireUser();
	return listTrainingWorkerJobs(context.env, user.id);
}

export async function listTrainingJobEvents(
	context: ServiceContext,
	providerId: TrainingProviderId,
	jobName: string,
): Promise<TrainingJobEvent[]> {
	const user = context.requireUser();
	return listTrainingWorkerJobEvents(context.env, providerId, jobName, user.id);
}

export async function deployTrainingModel(
	context: ServiceContext,
	request: DeployTrainingModelRequest,
): Promise<TrainingDeployment> {
	const user = context.requireUser();
	const model = requireTrainingModel(request.provider, request.modelId);
	if (
		request.deploymentTarget === "bedrock-import" &&
		!request.modelArtifactsS3Uri &&
		!request.trainingJobName
	) {
		throw new AssistantError(
			"Bedrock import requires a Hugging Face model files S3 prefix or an import-ready training job",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const sourceUriError =
		request.deploymentTarget === "bedrock-import"
			? getBedrockImportModelSourceUriError(request.modelArtifactsS3Uri)
			: undefined;
	if (sourceUriError) {
		throw new AssistantError(sourceUriError, ErrorType.PARAMS_ERROR, 400);
	}

	return deployTrainingWorkerModel(
		context.env,
		{
			...request,
			model,
			environment: resolveTrainingDeploymentEnvironment({ model, request }),
			requestId: context.requestId,
		},
		user.id,
	);
}

export async function getTrainingDeployment(
	context: ServiceContext,
	providerId: TrainingProviderId,
	endpointName: string,
): Promise<TrainingDeployment> {
	const user = context.requireUser();
	return getTrainingWorkerDeployment(context.env, providerId, endpointName, user.id);
}

export async function listTrainingDeployments(
	context: ServiceContext,
): Promise<TrainingDeployment[]> {
	const user = context.requireUser();
	return listTrainingWorkerDeployments(context.env, user.id);
}

export async function deleteTrainingDeployment(
	context: ServiceContext,
	providerId: TrainingProviderId,
	endpointName: string,
): Promise<TrainingDeploymentDeleteResponse> {
	const user = context.requireUser();
	return deleteTrainingWorkerDeployment(context.env, providerId, endpointName, user.id);
}

function requireTrainingModel(
	providerId: TrainingProviderId,
	modelId: string,
): TrainingModelDefinition {
	const model = getTrainingModel(modelId);
	if (!model) {
		throw new AssistantError("Unsupported training model", ErrorType.PARAMS_ERROR, 400);
	}

	if (model.provider !== providerId) {
		throw new AssistantError(
			`Model ${modelId} is not available through ${providerId}`,
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	return model;
}
