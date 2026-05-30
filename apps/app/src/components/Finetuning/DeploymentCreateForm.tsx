import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
	DeployFineTunedModelRequest,
	FineTuningJob,
	FineTuningModelDefinition,
} from "@assistant/schemas";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button, FormInput, FormSelect } from "~/components/ui";
import { getErrorMessage } from "~/lib/errors";
import {
	canDeployBaseTrainingModel,
	getDeployableTrainingModels,
	getDeploymentTrainingJobs,
	getTrainingModelLabel,
	parseOptionalPositiveInteger,
} from "./utils";

interface DeploymentCreateFormProps {
	models: FineTuningModelDefinition[];
	jobs: FineTuningJob[];
	isSubmitting: boolean;
	onSubmit: (request: DeployFineTunedModelRequest) => Promise<void>;
}

export function DeploymentCreateForm({
	models,
	jobs,
	isSubmitting,
	onSubmit,
}: DeploymentCreateFormProps) {
	const deployableModels = useMemo(() => getDeployableTrainingModels(models), [models]);
	const [modelId, setModelId] = useState("");
	const [deploymentName, setDeploymentName] = useState("");
	const [trainingJobName, setTrainingJobName] = useState("");
	const [modelArtifactsS3Uri, setModelArtifactsS3Uri] = useState("");
	const [instanceType, setInstanceType] = useState("");
	const [instanceCount, setInstanceCount] = useState("1");

	useEffect(() => {
		if (!modelId && deployableModels[0]) {
			setModelId(deployableModels[0].id);
		}
	}, [deployableModels, modelId]);

	const selectedModel = useMemo(
		() => deployableModels.find((model) => model.id === modelId) ?? deployableModels[0],
		[deployableModels, modelId],
	);

	const deploymentJobs = useMemo(
		() => (selectedModel ? getDeploymentTrainingJobs(jobs, selectedModel.id) : []),
		[jobs, selectedModel],
	);

	useEffect(() => {
		if (trainingJobName && !deploymentJobs.some((job) => job.jobName === trainingJobName)) {
			setTrainingJobName("");
		}
	}, [deploymentJobs, trainingJobName]);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedModel) return;

		const trimmedArtifactsUri = modelArtifactsS3Uri.trim();
		const trimmedTrainingJobName = trainingJobName.trim();
		const canDeployBaseModel = canDeployBaseTrainingModel(selectedModel);

		if (!trimmedArtifactsUri && !trimmedTrainingJobName && !canDeployBaseModel) {
			toast.error("Select a completed job or provide model artifacts");
			return;
		}

		try {
			await onSubmit({
				provider: selectedModel.provider,
				modelId: selectedModel.id,
				deploymentName: deploymentName.trim() || undefined,
				trainingJobName: trimmedTrainingJobName || undefined,
				modelArtifactsS3Uri: trimmedArtifactsUri || undefined,
				instanceType: instanceType.trim() || undefined,
				instanceCount: parseOptionalPositiveInteger(instanceCount, "Instance count"),
			});

			setDeploymentName("");
			setTrainingJobName("");
			setModelArtifactsS3Uri("");
			setInstanceType("");
			toast.success("Deployment submitted");
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to deploy model"));
		}
	};

	if (deployableModels.length === 0) {
		return (
			<p className="text-sm text-zinc-500 dark:text-zinc-400">
				No deployable SageMaker models are configured yet.
			</p>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<FormSelect
				id="deployment-model"
				label="Model"
				value={selectedModel?.id ?? ""}
				onChange={(event) => setModelId(event.target.value)}
				options={deployableModels.map((model) => ({
					value: model.id,
					label: getTrainingModelLabel(model),
				}))}
			/>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<FormInput
					id="deployment-name"
					label="Deployment name"
					value={deploymentName}
					onChange={(event) => setDeploymentName(event.target.value)}
					placeholder="distilbert-imdb-v1"
				/>
				<FormSelect
					id="deployment-training-job"
					label="Completed job"
					value={trainingJobName}
					onChange={(event) => setTrainingJobName(event.target.value)}
					options={[
						{ value: "", label: "Deploy base model from Hub" },
						...deploymentJobs.map((job) => ({
							value: job.jobName,
							label: job.jobName,
						})),
					]}
				/>
			</div>

			<FormInput
				id="deployment-artifacts-uri"
				label="Model artifacts S3 URI"
				value={modelArtifactsS3Uri}
				onChange={(event) => setModelArtifactsS3Uri(event.target.value)}
				placeholder="Optional fine-tuned model.tar.gz S3 URI"
			/>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<FormInput
					id="deployment-instance-type"
					label="Instance type"
					value={instanceType}
					onChange={(event) => setInstanceType(event.target.value)}
					placeholder={selectedModel?.defaultDeploymentInstanceType ?? "Provider default"}
				/>
				<FormInput
					id="deployment-instance-count"
					label="Instance count"
					type="number"
					value={instanceCount}
					onChange={(event) => setInstanceCount(event.target.value)}
				/>
			</div>

			<Button
				type="submit"
				variant="primary"
				icon={<UploadCloud className="h-4 w-4" />}
				isLoading={isSubmitting}
			>
				Deploy model
			</Button>
		</form>
	);
}
