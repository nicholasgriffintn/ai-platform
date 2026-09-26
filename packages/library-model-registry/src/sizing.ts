import type {
  HardwareOption,
  ModelArchitecture,
  Quantisation,
  SizingEstimate,
} from "@ngriffin_uk/polychat-schemas";
import {
  readFiniteNumber,
  readNonEmptyString,
  readRecord,
} from "@ngriffin_uk/polychat-utility-core";

const BYTES_PER_PARAMETER: Record<Quantisation, number> = {
  none: 2,
  fp8: 1,
  awq: 0.5625,
  gptq: 0.5625,
  nvfp4: 0.5625,
  "bnb-4bit": 0.5625,
  gguf: 1.0625,
};

const KV_BYTES_PER_VALUE = 2;
const RUNTIME_OVERHEAD_FRACTION = 0.1;
const RUNTIME_OVERHEAD_FLOOR_BYTES = 1.5 * 1024 ** 3;
const USABLE_MEMORY_FRACTION = 0.9;

function positive(value: unknown): number | null {
  const number = readFiniteNumber(value);

  return number !== undefined && number > 0 ? Math.round(number) : null;
}

export function architectureFromConfig(
  config: Record<string, unknown> | null,
): ModelArchitecture | null {
  if (!config) {
    return null;
  }

  const text = readRecord(config.text_config);
  const source = Object.keys(text).length > 0 ? { ...config, ...text } : config;
  const hiddenSize = positive(source.hidden_size ?? source.d_model ?? source.n_embd);
  const attentionHeads = positive(source.num_attention_heads ?? source.n_head);
  const kvHeads = positive(source.num_key_value_heads ?? source.num_kv_heads) ?? attentionHeads;

  return {
    modelType: readNonEmptyString(config.model_type) ?? null,
    layers: positive(source.num_hidden_layers ?? source.n_layer ?? source.num_layers),
    hiddenSize,
    attentionHeads,
    kvHeads,
    headDim:
      positive(source.head_dim) ??
      (hiddenSize !== null && attentionHeads !== null
        ? Math.round(hiddenSize / attentionHeads)
        : null),
    contextLength: positive(
      source.max_position_embeddings ??
        source.max_sequence_length ??
        source.seq_length ??
        source.n_positions,
    ),
    torchDtype: readNonEmptyString(source.torch_dtype ?? config.torch_dtype) ?? null,
  };
}

export function estimateSizing({
  parameterCount,
  architecture,
  quantisation,
  contextLength,
  concurrency,
}: {
  parameterCount: number | null;
  architecture: ModelArchitecture | null;
  quantisation: Quantisation;
  contextLength: number;
  concurrency: number;
}): SizingEstimate | null {
  if (parameterCount === null || parameterCount <= 0) {
    return null;
  }

  const bytesPerParameter = BYTES_PER_PARAMETER[quantisation];
  const weightBytes = parameterCount * bytesPerParameter;
  const layers = architecture?.layers ?? null;
  const kvHeads = architecture?.kvHeads ?? null;
  const headDim = architecture?.headDim ?? null;
  const hasKvShape = layers !== null && kvHeads !== null && headDim !== null;
  const kvBytesPerToken = hasKvShape
    ? 2 * layers * kvHeads * headDim * KV_BYTES_PER_VALUE
    : Math.round(parameterCount * 0.00013 * KV_BYTES_PER_VALUE);
  const effectiveContext = Math.min(contextLength, architecture?.contextLength ?? contextLength);
  const kvBytes = kvBytesPerToken * effectiveContext * concurrency;
  const overheadBytes = Math.max(
    RUNTIME_OVERHEAD_FLOOR_BYTES,
    weightBytes * RUNTIME_OVERHEAD_FRACTION,
  );

  return {
    parameters: parameterCount,
    quantisation,
    bytesPerParameter,
    weightBytes,
    kvBytesPerToken,
    contextLength: effectiveContext,
    concurrency,
    kvBytes,
    overheadBytes,
    totalBytes: weightBytes + kvBytes + overheadBytes,
    basis: hasKvShape ? "config" : "parameters_only",
  };
}

export function hardwareFits(sizing: SizingEstimate | null, hardware: HardwareOption): boolean {
  if (sizing === null) {
    return true;
  }

  return sizing.totalBytes <= hardware.memoryGb * 1024 ** 3 * USABLE_MEMORY_FRACTION;
}

export function smallestFittingHardware(
  sizing: SizingEstimate | null,
  hardware: readonly HardwareOption[],
): HardwareOption | null {
  const fitting = hardware.filter((option) => hardwareFits(sizing, option));

  return (
    [...fitting].sort(
      (left, right) =>
        (left.hourlyUsd ?? Number.POSITIVE_INFINITY) -
        (right.hourlyUsd ?? Number.POSITIVE_INFINITY),
    )[0] ?? null
  );
}
