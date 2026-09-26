import type { TrainingMethod } from "@ngriffin_uk/polychat-schemas";

export const TRAINING_IMAGE = "pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime";

export const TRAINING_BASE_PACKAGES = [
  "trl==0.24.0",
  "peft==0.17.1",
  "transformers==4.56.2",
  "datasets==4.1.1",
  "accelerate==1.10.1",
  "huggingface_hub==0.35.3",
  "bitsandbytes==0.47.0",
];

const METHOD_PACKAGES: Partial<Record<TrainingMethod, string[]>> = {
  embedding: ["sentence-transformers==5.1.0"],
  quantise: ["llmcompressor==0.7.1", "gguf==0.17.1"],
};

export function trainingPackages(method: TrainingMethod): string[] {
  return [...TRAINING_BASE_PACKAGES, ...(METHOD_PACKAGES[method] ?? [])];
}

export const TRAINING_SCRIPT = String.raw`
import json
import os
import re
import time
import urllib.request

SPEC_PATH = os.environ.get("POLYCHAT_SPEC_PATH", "/opt/ml/input/data/code/spec.json")
SPEC = json.loads(os.environ.get("POLYCHAT_SPEC") or open(SPEC_PATH).read())
HP = SPEC["hyperparameters"]
METHOD = SPEC["method"]
OUTPUT_MODE = os.environ.get("POLYCHAT_OUTPUT") or SPEC.get("output", "hub")
OUTPUT_DIR = "/opt/ml/model" if OUTPUT_MODE == "dir" else "/tmp/out"
for key, value in (SPEC.get("secrets") or {}).items():
    os.environ.setdefault(key, value)
STATE = {"metrics": [], "checkpoints": [], "status": "running", "error": None}


def report(force=False):
    url = os.environ.get("METRICS_URL")
    if not url:
        return
    now = time.time()
    if not force and now - STATE.get("_sent", 0) < 30:
        return
    STATE["_sent"] = now
    body = json.dumps({k: v for k, v in STATE.items() if not k.startswith("_")}).encode()
    request = urllib.request.Request(url, data=body, method="PUT", headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(request, timeout=30)
    except Exception as error:
        print("metrics upload failed", error)


def fetch(env_name, path, channel):
    url = os.environ.get(env_name)
    if url:
        urllib.request.urlretrieve(url, path)
        return path
    local = "/opt/ml/input/data/%s/data.jsonl" % channel
    if os.path.exists(local):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(local) as source, open(path, "w") as target:
            target.write(source.read())
        return path
    return None


def rows(path):
    with open(path) as handle:
        return [json.loads(line) for line in handle if line.strip()]


def dataset(path):
    from datasets import Dataset
    return Dataset.from_list(rows(path)) if path else None


def learning_rate():
    if HP.get("learningRate"):
        return float(HP["learningRate"])
    if SPEC["adaptation"] == "full":
        return 1e-5
    return 5e-6 if METHOD in ("dpo", "rft") else 1e-4


def lora_config():
    if SPEC["adaptation"] == "full":
        return None
    from peft import LoraConfig
    return LoraConfig(
        r=int(HP["loraRank"]),
        lora_alpha=int(HP["loraAlpha"]),
        lora_dropout=float(HP["loraDropout"]),
        target_modules="all-linear",
        task_type="CAUSAL_LM",
    )


def model_kwargs():
    import torch
    kwargs = {
        "revision": SPEC["base"]["revision"],
        "trust_remote_code": bool(SPEC["base"].get("remoteCode")),
        "dtype": torch.bfloat16,
    }
    if SPEC["adaptation"] == "qlora":
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
    return kwargs


def common_args():
    return dict(
        output_dir=OUTPUT_DIR,
        num_train_epochs=float(HP["epochs"]),
        learning_rate=learning_rate(),
        per_device_train_batch_size=int(HP["batchSize"]),
        gradient_accumulation_steps=int(HP["gradientAccumulation"]),
        warmup_ratio=float(HP["warmupRatio"]),
        weight_decay=float(HP["weightDecay"]),
        seed=int(HP["seed"]),
        bf16=True,
        logging_steps=10,
        save_strategy="steps" if SPEC.get("checkpointEvery") else "no",
        save_steps=int(SPEC.get("checkpointEvery") or 500),
        eval_strategy="steps" if os.path.exists("/tmp/validation.jsonl") else "no",
        eval_steps=int(SPEC.get("checkpointEvery") or 100),
        report_to="none",
        push_to_hub=False,
    )


def callbacks():
    from transformers import TrainerCallback

    class Reporter(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kwargs):
            logs = logs or {}
            STATE["metrics"].append({
                "step": int(state.global_step),
                "epoch": logs.get("epoch"),
                "trainLoss": logs.get("loss"),
                "validLoss": logs.get("eval_loss"),
                "reward": logs.get("reward"),
                "learningRate": logs.get("learning_rate"),
            })
            report()

        def on_save(self, args, state, control, **kwargs):
            folder = os.path.join(args.output_dir, "checkpoint-%d" % state.global_step)
            if OUTPUT_MODE != "hub" or not os.path.isdir(folder):
                return
            from huggingface_hub import HfApi
            info = HfApi(token=os.environ["HF_TOKEN"]).upload_folder(
                folder_path=folder,
                repo_id=SPEC["outputRepository"],
                path_in_repo="checkpoints/step-%d" % state.global_step,
                ignore_patterns=["optimizer.pt", "scheduler.pt", "rng_state*"],
            )
            STATE["checkpoints"].append({"step": int(state.global_step), "revision": info.oid})
            report(force=True)

    return [Reporter()]


def grader_reward():
    grader = SPEC["grader"]
    config = grader["config"]
    kind = config["kind"]

    def text_of(completion):
        if isinstance(completion, list):
            return "".join(part.get("content", "") for part in completion if isinstance(part, dict))
        return str(completion)

    def normalise(value):
        return re.sub(r"\s+", " ", str(value or "")).strip().lower()

    def score(output, reference):
        if kind == "exact":
            return 1.0 if reference is not None and normalise(output) == normalise(reference) else 0.0
        if kind == "contains":
            return 1.0 if reference is not None and normalise(reference) in normalise(output) else 0.0
        if kind == "regex":
            return 1.0 if re.search(config["pattern"], output, re.IGNORECASE) else 0.0
        if kind == "json_schema":
            try:
                parsed = json.loads(output)
            except Exception:
                return 0.0
            return 1.0 if isinstance(parsed, dict) and all(key in parsed for key in config.get("requiredKeys", [])) else 0.0
        if kind == "numeric":
            try:
                found = re.findall(r"-?\d+(?:\.\d+)?", output)
                return 1.0 if found and abs(float(found[-1]) - float(reference)) <= float(config["tolerance"]) else 0.0
            except Exception:
                return 0.0
        return 0.0

    def reward(completions, reference=None, **kwargs):
        references = reference if isinstance(reference, list) else [reference] * len(completions)
        return [score(text_of(completion), ref) for completion, ref in zip(completions, references)]

    reward.__name__ = grader["metric"]
    return reward


def finish(model, tokenizer):
    model.save_pretrained(OUTPUT_DIR, safe_serialization=True)
    if tokenizer is not None:
        tokenizer.save_pretrained(OUTPUT_DIR)
    if OUTPUT_MODE == "hub":
        from huggingface_hub import HfApi
        api = HfApi(token=os.environ["HF_TOKEN"])
        api.create_repo(SPEC["outputRepository"], private=True, exist_ok=True)
        info = api.upload_folder(folder_path=OUTPUT_DIR, repo_id=SPEC["outputRepository"], ignore_patterns=["checkpoint-*"])
        STATE["revision"] = info.oid


def run_trl(trainer_cls, config_cls, extra_config, train, validation, **trainer_kwargs):
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(SPEC["base"]["repo"], revision=SPEC["base"]["revision"])
    config = config_cls(**common_args(), model_init_kwargs=model_kwargs(), **extra_config)
    trainer = trainer_cls(
        model=SPEC["base"]["repo"],
        args=config,
        train_dataset=train,
        eval_dataset=validation,
        processing_class=tokenizer,
        peft_config=lora_config(),
        callbacks=callbacks(),
        **trainer_kwargs,
    )
    trainer.train()
    model = trainer.model
    if SPEC["adaptation"] != "full" and SPEC.get("mergeAdapter"):
        model = model.merge_and_unload()
    finish(model, tokenizer)


def train_sft(train, validation):
    from trl import SFTConfig, SFTTrainer
    run_trl(SFTTrainer, SFTConfig, {"max_length": int(HP["maxSequenceLength"]), "packing": bool(HP["packing"])}, train, validation)


def train_text(train, validation):
    from trl import SFTConfig, SFTTrainer
    run_trl(SFTTrainer, SFTConfig, {"max_length": int(HP["maxSequenceLength"]), "packing": True, "dataset_text_field": "text"}, train, validation)


def train_dpo(train, validation):
    from trl import DPOConfig, DPOTrainer
    run_trl(DPOTrainer, DPOConfig, {"beta": float(HP["dpoBeta"]), "max_length": int(HP["maxSequenceLength"])}, train, validation)


def train_grpo(train, validation):
    from trl import GRPOConfig, GRPOTrainer
    run_trl(
        GRPOTrainer,
        GRPOConfig,
        {"num_generations": int(HP["generationsPerPrompt"]), "max_completion_length": min(2048, int(HP["maxSequenceLength"]))},
        train,
        validation,
        reward_funcs=[grader_reward()],
    )


def train_embedding(train, validation):
    from sentence_transformers import SentenceTransformer, SentenceTransformerTrainer, SentenceTransformerTrainingArguments, losses
    model = SentenceTransformer(SPEC["base"]["repo"], revision=SPEC["base"]["revision"])
    columns = ["query", "positive"] + (["negative"] if "negative" in train.column_names and all(train["negative"]) else [])
    train = train.select_columns(columns)
    args = SentenceTransformerTrainingArguments(**{k: v for k, v in common_args().items() if k not in ("push_to_hub",)})
    trainer = SentenceTransformerTrainer(
        model=model,
        args=args,
        train_dataset=train,
        loss=losses.MultipleNegativesRankingLoss(model),
        callbacks=callbacks(),
    )
    trainer.train()
    model.save_pretrained(OUTPUT_DIR)
    finish_folder()


def finish_folder():
    if OUTPUT_MODE == "hub":
        from huggingface_hub import HfApi
        api = HfApi(token=os.environ["HF_TOKEN"])
        api.create_repo(SPEC["outputRepository"], private=True, exist_ok=True)
        info = api.upload_folder(folder_path=OUTPUT_DIR, repo_id=SPEC["outputRepository"], ignore_patterns=["checkpoint-*"])
        STATE["revision"] = info.oid


def merge_models():
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    base = AutoModelForCausalLM.from_pretrained(SPEC["base"]["repo"], **{k: v for k, v in model_kwargs().items() if k != "quantization_config"})
    tokenizer = AutoTokenizer.from_pretrained(SPEC["base"]["repo"], revision=SPEC["base"]["revision"])
    adapters = [item for item in SPEC["merge"] if item["kind"] == "adapter"]
    models = [item for item in SPEC["merge"] if item["kind"] == "model"]
    if adapters:
        from peft import PeftModel
        for adapter in adapters:
            base = PeftModel.from_pretrained(base, adapter["repo"], revision=adapter["revision"]).merge_and_unload()
    if models:
        state = {key: value.clone().float() for key, value in base.state_dict().items()}
        for item in models:
            other = AutoModelForCausalLM.from_pretrained(item["repo"], revision=item["revision"], dtype=torch.bfloat16).state_dict()
            for key in state:
                state[key] += other[key].float()
        count = len(models) + 1
        base.load_state_dict({key: (value / count).to(torch.bfloat16) for key, value in state.items()})
    finish(base, tokenizer)


def quantise_model():
    scheme = SPEC["quantisation"]
    if scheme == "gguf":
        os.system("git clone --depth 1 https://github.com/ggml-org/llama.cpp /tmp/llama.cpp && pip install --quiet -r /tmp/llama.cpp/requirements/requirements-convert_hf_to_gguf.txt")
        from huggingface_hub import snapshot_download
        source = snapshot_download(SPEC["base"]["repo"], revision=SPEC["base"]["revision"], token=os.environ.get("HF_TOKEN"))
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        code = os.system("python /tmp/llama.cpp/convert_hf_to_gguf.py %s --outtype q8_0 --outfile %s/model-q8_0.gguf" % (source, OUTPUT_DIR))
        if code != 0:
            raise RuntimeError("GGUF conversion failed")
        finish_folder()
        return
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(SPEC["base"]["repo"], revision=SPEC["base"]["revision"])
    kwargs = {k: v for k, v in model_kwargs().items() if k != "quantization_config"}
    if scheme == "bnb-4bit":
        import torch
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16)
        model = AutoModelForCausalLM.from_pretrained(SPEC["base"]["repo"], **kwargs)
        finish(model, tokenizer)
        return
    from llmcompressor import oneshot
    from llmcompressor.modifiers.quantization import GPTQModifier, QuantizationModifier
    from llmcompressor.modifiers.awq import AWQModifier
    model = AutoModelForCausalLM.from_pretrained(SPEC["base"]["repo"], **kwargs)
    recipes = {
        "fp8": QuantizationModifier(targets="Linear", scheme="FP8_DYNAMIC", ignore=["lm_head"]),
        "nvfp4": QuantizationModifier(targets="Linear", scheme="NVFP4", ignore=["lm_head"]),
        "gptq": GPTQModifier(targets="Linear", scheme="W4A16", ignore=["lm_head"]),
        "awq": AWQModifier(targets="Linear", scheme="W4A16_ASYM", ignore=["lm_head"]),
    }
    calibration = None
    if scheme in ("gptq", "awq", "nvfp4"):
        from datasets import Dataset
        samples = rows("/tmp/train.jsonl")[:256] if os.path.exists("/tmp/train.jsonl") else [{"text": "The quick brown fox jumps over the lazy dog."}] * 64
        texts = [sample["text"] if "text" in sample else tokenizer.apply_chat_template(sample["messages"], tokenize=False) for sample in samples]
        calibration = Dataset.from_list([tokenizer(text, truncation=True, max_length=2048) for text in texts])
    oneshot(model=model, dataset=calibration, recipe=recipes[scheme], max_seq_length=2048, num_calibration_samples=len(calibration) if calibration is not None else 0)
    model.save_pretrained(OUTPUT_DIR, save_compressed=True)
    tokenizer.save_pretrained(OUTPUT_DIR)
    finish_folder()


def main():
    train = dataset(fetch("TRAIN_URL", "/tmp/train.jsonl", "train"))
    validation = dataset(fetch("VALIDATION_URL", "/tmp/validation.jsonl", "validation"))
    handlers = {
        "sft": lambda: train_sft(train, validation),
        "distillation": lambda: train_sft(train, validation),
        "vision_sft": lambda: train_sft(train, validation),
        "continued_pretraining": lambda: train_text(train, validation),
        "dpo": lambda: train_dpo(train, validation),
        "rft": lambda: train_grpo(train, validation),
        "embedding": lambda: train_embedding(train, validation),
        "merge": merge_models,
        "quantise": quantise_model,
    }
    handlers[METHOD]()
    STATE["status"] = "completed"
    report(force=True)


try:
    main()
except Exception as error:
    STATE["status"] = "failed"
    STATE["error"] = str(error)[:2000]
    report(force=True)
    raise
`;

export function trainingCommand(
  method: TrainingMethod,
  scriptEnv = "POLYCHAT_TRAINING_SCRIPT",
): string[] {
  return [
    "bash",
    "-lc",
    `pip install --quiet ${trainingPackages(method).join(" ")} && python -c "$${scriptEnv}"`,
  ];
}
