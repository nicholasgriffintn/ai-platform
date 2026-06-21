import type { DeployTrainingModelRequest, TrainingModelDefinition } from "@assistant/schemas";

interface ResolveDeploymentEnvironmentOptions {
	model: TrainingModelDefinition;
	request: Pick<
		DeployTrainingModelRequest,
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
	normaliseHuggingFaceEnvironment(environment);

	return Object.keys(environment).length > 0 ? environment : undefined;
}

function normaliseHuggingFaceEnvironment(environment: Record<string, string>): void {
	const trustRemoteCode = environment.HF_TRUST_REMOTE_CODE?.toLowerCase();
	if (trustRemoteCode === "true") {
		environment.HF_TRUST_REMOTE_CODE = "True";
	}
	if (trustRemoteCode === "false") {
		environment.HF_TRUST_REMOTE_CODE = "False";
	}
}

function isHuggingFaceHubDeployment(
	model: TrainingModelDefinition,
	request: ResolveDeploymentEnvironmentOptions["request"],
): boolean {
	return model.family === "huggingface" && !request.modelArtifactsS3Uri && !request.trainingJobName;
}
