import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { FineTuningModelDefinition, StartFineTuningJobRequest } from "@assistant/schemas";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button, FormInput, FormSelect, Textarea } from "~/components/ui";
import { getErrorMessage } from "~/lib/errors";
import {
	getTrainingModelLabel,
	parseOptionalPositiveInteger,
	parseOptionalTrainingNumber,
	parseTrainingDatasetMode,
	parseTrainingHyperparameters,
} from "./utils";
import type { TrainingDatasetMode } from "./utils";

interface JobCreateFormProps {
	models: FineTuningModelDefinition[];
	isSubmitting: boolean;
	onSubmit: (request: StartFineTuningJobRequest) => Promise<void>;
}

export function JobCreateForm({ models, isSubmitting, onSubmit }: JobCreateFormProps) {
	const [modelId, setModelId] = useState("");
	const [datasetMode, setDatasetMode] = useState<TrainingDatasetMode>("s3");
	const [jobName, setJobName] = useState("");
	const [trainS3Uri, setTrainS3Uri] = useState("");
	const [validationS3Uri, setValidationS3Uri] = useState("");
	const [outputS3Uri, setOutputS3Uri] = useState("");
	const [appName, setAppName] = useState("");
	const [minFeedbackRating, setMinFeedbackRating] = useState("4");
	const [minQualityScore, setMinQualityScore] = useState("");
	const [limit, setLimit] = useState("500");
	const [instanceType, setInstanceType] = useState("");
	const [hyperparameters, setHyperparameters] = useState("");

	useEffect(() => {
		if (!modelId && models[0]) {
			setModelId(models[0].id);
		}
	}, [modelId, models]);

	const selectedModel = useMemo(
		() => models.find((model) => model.id === modelId) ?? models[0],
		[modelId, models],
	);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedModel) return;

		try {
			const parsedHyperparameters = parseTrainingHyperparameters(hyperparameters);
			const dataset =
				datasetMode === "s3"
					? {
							trainS3Uri: trainS3Uri.trim(),
							validationS3Uri: validationS3Uri.trim() || undefined,
						}
					: {
							trainingExampleFilters: {
								appName: appName.trim() || undefined,
								minFeedbackRating: parseOptionalTrainingNumber(minFeedbackRating, "Minimum rating"),
								minQualityScore: parseOptionalTrainingNumber(minQualityScore, "Minimum quality"),
								limit: parseOptionalPositiveInteger(limit, "Limit"),
							},
						};

			if (datasetMode === "s3" && !trainS3Uri.trim()) {
				toast.error("Provide a training S3 URI");
				return;
			}

			await onSubmit({
				provider: selectedModel.provider,
				modelId: selectedModel.id,
				jobName: jobName.trim() || undefined,
				dataset,
				outputS3Uri: outputS3Uri.trim() || undefined,
				instanceType: instanceType.trim() || undefined,
				hyperparameters: parsedHyperparameters,
			});

			setJobName("");
			setTrainS3Uri("");
			setValidationS3Uri("");
			setOutputS3Uri("");
			setHyperparameters("");
			toast.success("Fine-tuning job submitted");
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to start job"));
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<FormSelect
				id="training-model"
				label="Model"
				value={selectedModel?.id ?? ""}
				onChange={(event) => setModelId(event.target.value)}
				options={models.map((model) => ({
					value: model.id,
					label: getTrainingModelLabel(model),
				}))}
			/>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<FormInput
					id="training-job-name"
					label="Job name"
					value={jobName}
					onChange={(event) => setJobName(event.target.value)}
					placeholder="strudel-distilbert-v1"
				/>
				<FormSelect
					id="training-dataset-mode"
					label="Dataset"
					value={datasetMode}
					onChange={(event) => setDatasetMode(parseTrainingDatasetMode(event.target.value))}
					options={[
						{ value: "s3", label: "S3 dataset" },
						{ value: "examples", label: "Training examples" },
					]}
				/>
			</div>

			{datasetMode === "s3" ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<FormInput
						id="training-s3-uri"
						label="Training S3 URI"
						value={trainS3Uri}
						onChange={(event) => setTrainS3Uri(event.target.value)}
						placeholder="s3://bucket/train.jsonl"
					/>
					<FormInput
						id="validation-s3-uri"
						label="Validation S3 URI"
						value={validationS3Uri}
						onChange={(event) => setValidationS3Uri(event.target.value)}
						placeholder="s3://bucket/validation.jsonl"
					/>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
					<FormInput
						id="training-filter-app"
						label="App name"
						value={appName}
						onChange={(event) => setAppName(event.target.value)}
						placeholder="strudel"
					/>
					<FormInput
						id="training-filter-rating"
						label="Min rating"
						type="number"
						value={minFeedbackRating}
						onChange={(event) => setMinFeedbackRating(event.target.value)}
					/>
					<FormInput
						id="training-filter-quality"
						label="Min quality"
						type="number"
						value={minQualityScore}
						onChange={(event) => setMinQualityScore(event.target.value)}
					/>
					<FormInput
						id="training-filter-limit"
						label="Limit"
						type="number"
						value={limit}
						onChange={(event) => setLimit(event.target.value)}
					/>
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<FormInput
					id="training-output-uri"
					label="Output S3 URI"
					value={outputS3Uri}
					onChange={(event) => setOutputS3Uri(event.target.value)}
					placeholder="s3://bucket/output/job-name/"
				/>
				<FormInput
					id="training-instance-type"
					label="Instance type"
					value={instanceType}
					onChange={(event) => setInstanceType(event.target.value)}
					placeholder={selectedModel?.defaultInstanceType ?? "Provider default"}
				/>
			</div>

			<div className="space-y-1">
				<label htmlFor="training-hyperparameters" className="text-sm font-medium">
					Hyperparameters
				</label>
				<Textarea
					id="training-hyperparameters"
					value={hyperparameters}
					onChange={(event) => setHyperparameters(event.target.value)}
					placeholder='{"epochs": 1, "train_batch_size": 16}'
					rows={4}
				/>
			</div>

			<Button
				type="submit"
				variant="primary"
				icon={<Rocket className="h-4 w-4" />}
				isLoading={isSubmitting}
			>
				Start job
			</Button>
		</form>
	);
}
