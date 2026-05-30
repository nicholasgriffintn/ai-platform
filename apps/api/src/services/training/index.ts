import type { ServiceContext } from "~/lib/context/serviceContext";
import { exportTrainingExamplesToS3 } from "~/lib/providers/capabilities/training/exportDataset";
import {
	fineTuningModelCatalog,
	getFineTuningModel,
} from "~/lib/providers/capabilities/training/modelCatalog";
import { resolveTrainingDeploymentEnvironment } from "~/lib/providers/capabilities/training/trainingDeploymentEnvironment";
import { resolveTrainingHyperparameters } from "~/lib/providers/capabilities/training/trainingHyperparameters";
import { resolveTrainingSource } from "~/lib/providers/capabilities/training/trainingSourceArchives";
import type {
	DeployFineTunedModelRequest,
	FineTunedDeployment,
	FineTuningJob,
	FineTuningJobEvent,
	FineTuningModelDefinition,
	FineTuningProviderId,
	StartFineTuningJobRequest,
} from "~/types/training";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	deployFinetuneWorkerModel,
	getFinetuneWorkerDeployment,
	getFinetuneWorkerJob,
	listFinetuneWorkerDeployments,
	listFinetuneWorkerJobEvents,
	listFinetuneWorkerJobs,
	startFinetuneWorkerJob,
} from "./finetuneWorkerClient";

export async function listFineTuningModels(
	context: ServiceContext,
): Promise<FineTuningModelDefinition[]> {
	context.requireUser();
	return fineTuningModelCatalog;
}

export async function startFineTuningJob(
	context: ServiceContext,
	request: StartFineTuningJobRequest,
): Promise<FineTuningJob> {
	const user = context.requireUser();
	const model = requireFineTuningModel(request.provider, request.modelId);
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

	return startFinetuneWorkerJob(
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

export async function getFineTuningJob(
	context: ServiceContext,
	providerId: FineTuningProviderId,
	jobName: string,
): Promise<FineTuningJob> {
	const user = context.requireUser();
	return getFinetuneWorkerJob(context.env, providerId, jobName, user.id);
}

export async function listFineTuningJobs(context: ServiceContext): Promise<FineTuningJob[]> {
	const user = context.requireUser();
	return listFinetuneWorkerJobs(context.env, user.id);
}

export async function listFineTuningJobEvents(
	context: ServiceContext,
	providerId: FineTuningProviderId,
	jobName: string,
): Promise<FineTuningJobEvent[]> {
	const user = context.requireUser();
	return listFinetuneWorkerJobEvents(context.env, providerId, jobName, user.id);
}

export async function deployFineTunedModel(
	context: ServiceContext,
	request: DeployFineTunedModelRequest,
): Promise<FineTunedDeployment> {
	const user = context.requireUser();
	const model = requireFineTuningModel(request.provider, request.modelId);
	return deployFinetuneWorkerModel(
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

export async function getFineTunedDeployment(
	context: ServiceContext,
	providerId: FineTuningProviderId,
	endpointName: string,
): Promise<FineTunedDeployment> {
	const user = context.requireUser();
	return getFinetuneWorkerDeployment(context.env, providerId, endpointName, user.id);
}

export async function listFineTunedDeployments(
	context: ServiceContext,
): Promise<FineTunedDeployment[]> {
	const user = context.requireUser();
	return listFinetuneWorkerDeployments(context.env, user.id);
}

function requireFineTuningModel(
	providerId: FineTuningProviderId,
	modelId: string,
): FineTuningModelDefinition {
	const model = getFineTuningModel(modelId);
	if (!model) {
		throw new AssistantError("Unsupported fine-tuning model", ErrorType.PARAMS_ERROR, 400);
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
