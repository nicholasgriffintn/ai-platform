import type {
  Adaptation,
  DatasetShape,
  DeploymentShape,
  LawfulBasis,
  TrainingMethod,
} from "@ngriffin_uk/polychat-schemas";

export const TRAINING_METHOD_LABELS: Record<TrainingMethod, string> = {
  sft: "Supervised",
  distillation: "Distillation",
  vision_sft: "Vision",
  dpo: "Preference (DPO)",
  rft: "Reinforcement (GRPO)",
  continued_pretraining: "Continued pretraining",
  embedding: "Embeddings",
  merge: "Merge",
  quantise: "Quantise",
};

export const ADAPTATION_LABELS: Record<Adaptation, string> = {
  lora: "LoRA adapter",
  qlora: "QLoRA adapter (4-bit base)",
  full: "Full fine-tune",
};

export const DATASET_SHAPE_LABELS: Record<DatasetShape, string> = {
  messages: "Chat messages",
  preference: "Preference pairs",
  prompt_grader: "Prompts with references",
  text: "Plain text",
  retrieval: "Retrieval pairs",
  image_text: "Images with text",
  audio_text: "Audio with transcripts",
};

export const LAWFUL_BASIS_LABELS: Record<LawfulBasis, string> = {
  not_personal_data: "No personal data",
  consent: "Consent",
  contract: "Contract",
  legitimate_interests: "Legitimate interests",
  legal_obligation: "Legal obligation",
  unknown: "Not yet known",
};

export const DEPLOYMENT_SHAPE_LABELS: Record<DeploymentShape, string> = {
  serverless: "Serverless",
  dedicated: "Dedicated",
  adapter_pool: "Adapter pool",
  external: "External endpoint",
};
