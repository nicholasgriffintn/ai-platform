import { OCR_BATCH_POLLING_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { OcrBatchPollingHandler } from "./OcrBatchPollingHandler";
import { researchPolling } from "./research-polling";

export function registerJobsQueue(workflows: AppWorkflows): void {
  workflows.poll("research_polling", researchPolling);
  workflows.register(OCR_BATCH_POLLING_TASK_TYPE, new OcrBatchPollingHandler());
}
