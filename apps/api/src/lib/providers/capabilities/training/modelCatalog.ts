import type { TrainingModelDefinition } from "~/types/training";

const HUGGING_FACE_LLM_TRAINING_IMAGE =
	"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-training:2.8.0-transformers4.56.2-gpu-py312-cu129-ubuntu22.04";
const HUGGING_FACE_LLM_INFERENCE_IMAGE =
	"763104351884.dkr.ecr.{region}.amazonaws.com/huggingface-pytorch-inference:2.6.0-transformers5.5.3-gpu-py312-cu124-ubuntu22.04";

export const trainingModelCatalog: TrainingModelDefinition[] = [
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
			s3Key: "training/sources/huggingface/transformers-v4.56.2.tar.gz",
			contentType: "application/gzip",
		},
		trainingImage: HUGGING_FACE_LLM_TRAINING_IMAGE,
		inferenceImage: HUGGING_FACE_LLM_INFERENCE_IMAGE,
		defaultDeploymentEnvironment: {
			HF_TASK: "text-generation",
			HF_TRUST_REMOTE_CODE: "True",
		},
		supportedTasks: ["text-generation", "causal-language-modeling"],
	},
];

export function getTrainingModel(modelId: string): TrainingModelDefinition | undefined {
	return trainingModelCatalog.find((model) => model.id === modelId || model.baseModel === modelId);
}
