import { appendResourceNameSuffix, sanitiseResourceName } from "./names.js";

export interface SageMakerDeploymentNames {
	deploymentName: string;
	modelName: string;
	endpointConfigName: string;
	endpointName: string;
}

interface SageMakerDeploymentNameOptions {
	resourceVersion?: string;
}

export function getSageMakerDeploymentNames(
	deploymentName: string,
	options: SageMakerDeploymentNameOptions = {},
): SageMakerDeploymentNames {
	const sanitisedDeploymentName = sanitiseResourceName(deploymentName, {
		fallback: `training-${Date.now()}`,
	});
	const resourceBaseName = options.resourceVersion
		? appendResourceNameSuffix(
				sanitisedDeploymentName,
				sanitiseResourceName(options.resourceVersion, { fallback: "version" }),
			)
		: sanitisedDeploymentName;

	return {
		deploymentName: sanitisedDeploymentName,
		modelName: appendResourceNameSuffix(resourceBaseName, "model"),
		endpointConfigName: appendResourceNameSuffix(resourceBaseName, "config"),
		endpointName: appendResourceNameSuffix(sanitisedDeploymentName, "endpoint"),
	};
}
