import {
  MODEL_REGISTRY_EVAL_TASK_TYPE,
  MODEL_REGISTRY_INSPECT_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { ModelRegistryEvalHandler, ModelRegistryInspectHandler } from "./ModelRegistryHandlers";

export function registerModelRegistryQueue(workflows: AppWorkflows): void {
  workflows.register(MODEL_REGISTRY_INSPECT_TASK_TYPE, new ModelRegistryInspectHandler());
  workflows.register(MODEL_REGISTRY_EVAL_TASK_TYPE, new ModelRegistryEvalHandler());
}
