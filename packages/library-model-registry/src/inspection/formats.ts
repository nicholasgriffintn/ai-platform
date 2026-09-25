import type { WeightFormat } from "@ngriffin_uk/polychat-schemas";

const FORMAT_BY_EXTENSION: Record<string, WeightFormat> = {
  safetensors: "safetensors",
  gguf: "gguf",
  bin: "pickle",
  pt: "pickle",
  pth: "pickle",
  ckpt: "pickle",
  pkl: "pickle",
  pickle: "pickle",
  joblib: "pickle",
  onnx: "onnx",
  h5: "other",
  msgpack: "other",
  npz: "other",
  tflite: "other",
};

export function detectWeightFormat(path: string): WeightFormat | null {
  const name = path.split("/").pop() ?? path;
  const extension = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";

  return FORMAT_BY_EXTENSION[extension] ?? null;
}

export function collectWeightFormats(paths: readonly string[]): WeightFormat[] {
  const formats = new Set<WeightFormat>();

  for (const path of paths) {
    const format = detectWeightFormat(path);

    if (format) {
      formats.add(format);
    }
  }

  return [...formats].sort();
}
