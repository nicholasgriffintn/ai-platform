import type { FineTuningModelDefinition } from "~/types/training";

const HUGGING_FACE_TRAINING_IMAGE =
	"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-training:2.1.0-transformers4.36.0-gpu-py310-cu121-ubuntu20.04";
const HUGGING_FACE_INFERENCE_IMAGE =
	"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-inference:2.1.0-transformers4.36.0-gpu-py310-cu121-ubuntu20.04";
const HUGGING_FACE_LLM_TRAINING_IMAGE =
	"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-training:2.8.0-transformers4.56.2-gpu-py312-cu129-ubuntu22.04";
const HUGGING_FACE_LLM_INFERENCE_IMAGE =
	"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-inference:2.6.0-transformers4.51.3-gpu-py312-cu124-ubuntu22.04";

export const fineTuningModelCatalog: FineTuningModelDefinition[] = [
	{
		id: "nova-lite",
		provider: "aws-bedrock",
		family: "bedrock",
		name: "Amazon Nova Lite",
		description: "Cost-effective Amazon Bedrock model for customisation and distillation jobs.",
		baseModel: "amazon.nova-lite-v1:0",
		defaultHyperparameters: {
			epochCount: 2,
			learningRate: "0.00005",
			batchSize: 1,
			learningRateWarmupSteps: 0,
		},
		supportedTasks: ["chat", "strudel"],
	},
	{
		id: "distilbert-imdb",
		provider: "aws-sagemaker",
		family: "huggingface",
		name: "DistilBERT text classifier",
		description:
			"A small Hugging Face Transformers model suitable for quick text classification fine-tuning.",
		baseModel: "distilbert/distilbert-base-uncased",
		defaultInstanceType: "ml.p3.2xlarge",
		defaultDeploymentInstanceType: "ml.g4dn.xlarge",
		defaultHyperparameters: {
			model_name_or_path: "distilbert/distilbert-base-uncased",
			epochs: 1,
			train_batch_size: 32,
		},
		trainingImage: HUGGING_FACE_TRAINING_IMAGE,
		inferenceImage: HUGGING_FACE_INFERENCE_IMAGE,
		defaultDeploymentEnvironment: {
			HF_TASK: "text-classification",
		},
		supportedTasks: ["text-classification"],
	},
	{
		id: "bert-base-uncased",
		provider: "aws-sagemaker",
		family: "huggingface",
		name: "BERT base uncased",
		description: "General-purpose BERT base checkpoint for Hugging Face fine-tuning jobs.",
		baseModel: "google-bert/bert-base-uncased",
		defaultInstanceType: "ml.p3.2xlarge",
		defaultDeploymentInstanceType: "ml.g4dn.xlarge",
		defaultHyperparameters: {
			model_name_or_path: "google-bert/bert-base-uncased",
			epochs: 1,
			train_batch_size: 16,
		},
		trainingImage: HUGGING_FACE_TRAINING_IMAGE,
		inferenceImage: HUGGING_FACE_INFERENCE_IMAGE,
		defaultDeploymentEnvironment: {
			HF_TASK: "text-classification",
		},
		supportedTasks: ["text-classification", "token-classification"],
	},
	{
		id: "lizzy-7b",
		provider: "aws-sagemaker",
		family: "huggingface",
		name: "Lizzy 7B",
		description:
			"Flower Labs Lizzy 7B configured for Hugging Face causal language modelling on SageMaker.",
		baseModel: "flwrlabs/Lizzy-7B",
		defaultInstanceType: "ml.p3.2xlarge",
		defaultDeploymentInstanceType: "ml.g4dn.xlarge",
		defaultHyperparameters: {
			model_name_or_path: "flwrlabs/Lizzy-7B",
			output_dir: "/opt/ml/model",
			trust_remote_code: "True",
		},
		defaultEntryPoint: "transformers-4.56.2/examples/pytorch/language-modeling/run_clm.py",
		trainingDataFileHyperparameter: "train_file",
		validationDataFileHyperparameter: "validation_file",
		sourceArchive: {
			url: "https://github.com/huggingface/transformers/archive/refs/tags/v4.56.2.tar.gz",
			s3Key: "fine-tuning/sources/huggingface/transformers-v4.56.2.tar.gz",
			contentType: "application/gzip",
		},
		trainingImage: HUGGING_FACE_LLM_TRAINING_IMAGE,
		inferenceImage: HUGGING_FACE_LLM_INFERENCE_IMAGE,
		defaultDeploymentEnvironment: {
			HF_TASK: "text-generation",
			HF_TRUST_REMOTE_CODE: "true",
		},
		supportedTasks: ["text-generation", "causal-language-modeling"],
	},
];

export function getFineTuningModel(modelId: string): FineTuningModelDefinition | undefined {
	return fineTuningModelCatalog.find(
		(model) => model.id === modelId || model.baseModel === modelId,
	);
}
