import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
	getBedrockImportModelSourceUriError,
	trainingDeploymentTargetSchema,
	type DeployTrainingModelRequest,
	type TrainingDeploymentTarget,
	type TrainingJob,
	type TrainingModelDefinition,
} from "@assistant/schemas";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button, FormInput, FormSelect } from "~/components/ui";
import { getErrorMessage } from "~/lib/errors";
import {
	canDeployBaseTrainingModelForTarget,
	DEPLOYMENT_TARGET_OPTIONS,
	getDeploymentTargetError,
	getDeploymentInstanceTypeError,
	getDeployableTrainingModels,
	getDeploymentTrainingJobs,
	getTrainingModelLabel,
	parseOptionalPositiveInteger,
} from "./utils";

interface DeploymentCreateFormProps {
	models: TrainingModelDefinition[];
	jobs: TrainingJob[];
	isSubmitting: boolean;
	onSubmit: (request: DeployTrainingModelRequest) => Promise<void>;
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
	const [deploymentVersion, setDeploymentVersion] = useState("");
	const [trainingJobName, setTrainingJobName] = useState("");
	const [modelArtifactsS3Uri, setModelArtifactsS3Uri] = useState("");
	const [deploymentTarget, setDeploymentTarget] =
		useState<TrainingDeploymentTarget>("sagemaker-endpoint");
	const [instanceType, setInstanceType] = useState("");
	const [instanceCount, setInstanceCount] = useState("1");
	const [serverlessMemorySizeInMB, setServerlessMemorySizeInMB] = useState("6144");
	const [serverlessMaxConcurrency, setServerlessMaxConcurrency] = useState("5");

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
		const canDeployBaseModel = canDeployBaseTrainingModelForTarget(selectedModel, deploymentTarget);
		const targetError = getDeploymentTargetError(selectedModel, deploymentTarget);
		const sourceUriError =
			deploymentTarget === "bedrock-import"
				? getBedrockImportModelSourceUriError(trimmedArtifactsUri || undefined)
				: undefined;
		const instanceTypeError =
			deploymentTarget === "sagemaker-endpoint"
				? getDeploymentInstanceTypeError(selectedModel, instanceType)
				: undefined;

		if (!trimmedArtifactsUri && !trimmedTrainingJobName && !canDeployBaseModel) {
			toast.error(
				deploymentTarget === "bedrock-import"
					? "Bedrock import requires a Hugging Face model files S3 prefix or an import-ready job"
					: "Select a completed job or provide model artifacts",
			);
			return;
		}
		if (targetError) {
			toast.error(targetError);
			return;
		}
		if (sourceUriError) {
			toast.error(sourceUriError);
			return;
		}
		if (instanceTypeError) {
			toast.error(instanceTypeError);
			return;
		}

		try {
			await onSubmit({
				provider: selectedModel.provider,
				modelId: selectedModel.id,
				deploymentTarget,
				deploymentName: deploymentName.trim() || undefined,
				deploymentVersion: deploymentVersion.trim() || undefined,
				trainingJobName: trimmedTrainingJobName || undefined,
				modelArtifactsS3Uri: trimmedArtifactsUri || undefined,
				instanceType:
					deploymentTarget === "sagemaker-endpoint" ? instanceType.trim() || undefined : undefined,
				instanceCount:
					deploymentTarget === "sagemaker-endpoint"
						? parseOptionalPositiveInteger(instanceCount, "Instance count")
						: undefined,
				serverlessMemorySizeInMB:
					deploymentTarget === "sagemaker-serverless-endpoint"
						? parseOptionalPositiveInteger(serverlessMemorySizeInMB, "Memory size")
						: undefined,
				serverlessMaxConcurrency:
					deploymentTarget === "sagemaker-serverless-endpoint"
						? parseOptionalPositiveInteger(serverlessMaxConcurrency, "Max concurrency")
						: undefined,
			});

			setDeploymentName("");
			setDeploymentVersion("");
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
					placeholder="Optional custom deployment name"
				/>
				<FormInput
					id="deployment-version"
					label="Version"
					value={deploymentVersion}
					onChange={(event) => setDeploymentVersion(event.target.value)}
					placeholder="v1"
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<FormSelect
					id="deployment-target"
					label="Deployment target"
					value={deploymentTarget}
					onChange={(event) =>
						setDeploymentTarget(trainingDeploymentTargetSchema.parse(event.target.value))
					}
					options={DEPLOYMENT_TARGET_OPTIONS}
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
				label={
					deploymentTarget === "bedrock-import" ? "Model files S3 prefix" : "Model artifacts S3 URI"
				}
				value={modelArtifactsS3Uri}
				onChange={(event) => setModelArtifactsS3Uri(event.target.value)}
				placeholder={
					deploymentTarget === "bedrock-import"
						? "s3://bucket/path/to/huggingface-model/"
						: "Optional model artifact S3 URI"
				}
			/>

			{deploymentTarget === "sagemaker-endpoint" && (
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
			)}

			{deploymentTarget === "sagemaker-serverless-endpoint" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<FormInput
						id="deployment-serverless-memory"
						label="Memory (MB)"
						type="number"
						value={serverlessMemorySizeInMB}
						onChange={(event) => setServerlessMemorySizeInMB(event.target.value)}
					/>
					<FormInput
						id="deployment-serverless-concurrency"
						label="Max concurrency"
						type="number"
						value={serverlessMaxConcurrency}
						onChange={(event) => setServerlessMaxConcurrency(event.target.value)}
					/>
				</div>
			)}

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
