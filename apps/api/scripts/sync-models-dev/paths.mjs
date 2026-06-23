import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_FILE = fileURLToPath(import.meta.url);
const MODULE_DIR = path.dirname(MODULE_FILE);
export const API_ROOT = path.resolve(MODULE_DIR, "../..");
export const DEFAULT_MODELS_DIR = path.join(API_ROOT, "src/data-model/models");
