import type { TrainingDeployment, TrainingJob } from "@assistant/schemas";

export function mergeTrainingJob(stored: TrainingJob | null, live: TrainingJob): TrainingJob {
	if (!stored) return live;

	return {
		...stored,
		...live,
		modelId: live.modelId === "unknown" ? stored.modelId : live.modelId,
		baseModel: live.baseModel === "unknown" ? stored.baseModel : live.baseModel,
		trainingImage: live.trainingImage ?? stored.trainingImage,
		trainingDataS3Uri: live.trainingDataS3Uri ?? stored.trainingDataS3Uri,
		validationDataS3Uri: live.validationDataS3Uri ?? stored.validationDataS3Uri,
		outputS3Uri: live.outputS3Uri ?? stored.outputS3Uri,
		modelArtifactsS3Uri: live.modelArtifactsS3Uri ?? stored.modelArtifactsS3Uri,
	};
}

export function mergeTrainingDeployment(
	stored: TrainingDeployment | null,
	live: TrainingDeployment,
): TrainingDeployment {
	if (!stored) return live;
	const storedStatus = stored.status.toLowerCase();
	const liveStatus = live.status.toLowerCase();
	const liveMatchesStoredTarget = live.endpointConfigName === stored.endpointConfigName;
	const keepStoredUpdateAttempt =
		!liveMatchesStoredTarget &&
		((storedStatus === "updating" && liveStatus === "updating") ||
			(storedStatus === "failed" && liveStatus === "inservice"));
	const keepStoredModelName =
		live.modelName === live.endpointConfigName &&
		(keepStoredUpdateAttempt || liveMatchesStoredTarget);

	return {
		...stored,
		...live,
		deploymentName:
			live.deploymentName === live.endpointName ? stored.deploymentName : live.deploymentName,
		deploymentVersion: live.deploymentVersion ?? stored.deploymentVersion,
		modelName: keepStoredModelName ? stored.modelName : live.modelName,
		endpointConfigName: keepStoredUpdateAttempt
			? stored.endpointConfigName
			: live.endpointConfigName,
		status: keepStoredUpdateAttempt ? stored.status : live.status,
		modelId: live.modelId === "unknown" ? stored.modelId : live.modelId,
		failureReason: keepStoredUpdateAttempt ? stored.failureReason : live.failureReason,
		modelArtifactsS3Uri: live.modelArtifactsS3Uri ?? stored.modelArtifactsS3Uri,
	};
}
