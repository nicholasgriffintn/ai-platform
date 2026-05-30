import type { DeployFineTunedModelRequest, FineTuningModelDefinition } from "~/types/training";

interface ResolveDeploymentEnvironmentOptions {
	model: FineTuningModelDefinition;
	request: Pick<
		DeployFineTunedModelRequest,
		"environment" | "modelArtifactsS3Uri" | "trainingJobName"
	>;
}

export function resolveTrainingDeploymentEnvironment({
	model,
	request,
}: ResolveDeploymentEnvironmentOptions): Record<string, string> | undefined {
	const environment = {
		...model.defaultDeploymentEnvironment,
		...request.environment,
	};

	if (isHuggingFaceHubDeployment(model, request) && !environment.HF_MODEL_ID) {
		environment.HF_MODEL_ID = model.baseModel;
	}

	return Object.keys(environment).length > 0 ? environment : undefined;
}

function isHuggingFaceHubDeployment(
	model: FineTuningModelDefinition,
	request: ResolveDeploymentEnvironmentOptions["request"],
): boolean {
	return model.family === "huggingface" && !request.modelArtifactsS3Uri && !request.trainingJobName;
}
