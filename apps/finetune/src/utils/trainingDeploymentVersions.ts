import {
	trainingDeploymentTargetSchema,
	getTrainingDeploymentChatModelId,
	type TrainingDeployment,
	type TrainingDeploymentTarget,
} from "@assistant/schemas";

import { isRecord } from "./objects.js";
import { optionalString } from "./strings.js";

interface DeploymentNameInput {
	modelId: string;
	deploymentName?: string;
	deploymentVersion?: string;
}

export function normaliseDeploymentVersion(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export function getDeploymentNameInput({
	modelId,
	deploymentName,
	deploymentVersion,
}: DeploymentNameInput): string {
	const requestedDeploymentName = deploymentName?.trim();
	if (requestedDeploymentName) return requestedDeploymentName;

	const version = normaliseDeploymentVersion(deploymentVersion);
	if (version) return `${modelId}-${version}`;

	return `${modelId}-${Date.now()}`;
}

export function getDeploymentVersionFromRequest(request: unknown): string | undefined {
	if (!isRecord(request)) return undefined;

	return normaliseDeploymentVersion(optionalString(request.deploymentVersion));
}

export function getDeploymentTargetFromRequest(
	request: unknown,
): TrainingDeploymentTarget | undefined {
	if (!isRecord(request)) return undefined;

	return trainingDeploymentTargetSchema.safeParse(request.deploymentTarget).data;
}

export function withDeploymentVersion(
	deployment: TrainingDeployment,
	deploymentVersion: string | undefined,
): TrainingDeployment {
	return {
		...deployment,
		deploymentVersion: deploymentVersion ?? deployment.deploymentVersion,
		chatModelId: getTrainingDeploymentChatModelId({
			provider: deployment.provider,
			endpointName: deployment.endpointName,
		}),
	};
}
