export const HUGGINGFACE_TRAINING_IMAGE = "pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime";

export const HUGGINGFACE_TRAINING_PACKAGES = [
  "trl==0.24.0",
  "peft==0.17.1",
  "transformers==4.56.2",
  "datasets==4.1.1",
  "accelerate==1.10.1",
];

export const HUGGINGFACE_TRAINING_SCRIPT = `
import os
import urllib.request

from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

urllib.request.urlretrieve(os.environ["TRAIN_URL"], "/tmp/train.jsonl")
dataset = load_dataset("json", data_files="/tmp/train.jsonl", split="train")
dataset = dataset.remove_columns([c for c in dataset.column_names if c != "messages"])
lora = os.environ.get("RECIPE") == "sft-lora"

config = SFTConfig(
    output_dir="/tmp/out",
    num_train_epochs=float(os.environ.get("EPOCHS", "2")),
    learning_rate=float(os.environ.get("LEARNING_RATE", "1e-4" if lora else "2e-5")),
    per_device_train_batch_size=int(os.environ.get("BATCH_SIZE", "1")),
    gradient_accumulation_steps=int(os.environ.get("GRADIENT_ACCUMULATION", "8")),
    bf16=True,
    logging_steps=10,
    save_strategy="no",
    report_to="none",
    push_to_hub=True,
    hub_model_id=os.environ["OUTPUT_REPO"],
    hub_private_repo=True,
    model_init_kwargs={
        "revision": os.environ["BASE_REVISION"],
        "trust_remote_code": os.environ.get("TRUST_REMOTE_CODE") == "true",
        "dtype": "bfloat16",
    },
)

trainer = SFTTrainer(
    model=os.environ["BASE_MODEL"],
    args=config,
    train_dataset=dataset,
    peft_config=LoraConfig(
        r=int(os.environ.get("LORA_R", "16")),
        lora_alpha=int(os.environ.get("LORA_ALPHA", "32")),
        target_modules="all-linear",
        task_type="CAUSAL_LM",
    ) if lora else None,
)
trainer.train()

if lora:
    trainer.model = trainer.model.merge_and_unload()

trainer.save_model("/tmp/out")
trainer.push_to_hub()
`;

export function buildHuggingFaceTrainingCommand(): string[] {
  return [
    "bash",
    "-lc",
    `pip install --quiet ${HUGGINGFACE_TRAINING_PACKAGES.join(" ")} && python -c "$TRAINING_SCRIPT"`,
  ];
}
