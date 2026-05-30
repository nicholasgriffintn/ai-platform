import { appendResourceNameSuffix, sanitiseResourceName } from "./names.js";

export interface SageMakerDeploymentNames {
	deploymentName: string;
	modelName: string;
	endpointConfigName: string;
	endpointName: string;
}

export function getSageMakerDeploymentNames(deploymentName: string): SageMakerDeploymentNames {
	const sanitisedDeploymentName = sanitiseResourceName(deploymentName, {
		fallback: `training-${Date.now()}`,
	});

	return {
		deploymentName: sanitisedDeploymentName,
		modelName: appendResourceNameSuffix(sanitisedDeploymentName, "model"),
		endpointConfigName: appendResourceNameSuffix(sanitisedDeploymentName, "config"),
		endpointName: appendResourceNameSuffix(sanitisedDeploymentName, "endpoint"),
	};
}
