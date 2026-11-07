import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_MODELS_DIR = path.resolve(
  MODULE_DIR,
  "../../library-model-catalogue/src/data",
);
