import {
  NOTEBOOK_JOB_TASK_TYPE,
  notebookJobTaskDataSchema,
  type NotebookJobTaskData,
} from "@ngriffin_uk/polychat-schemas";

import { loadUserContext } from "~/modules/queue/application/user-context";
import { defineTask, type AppWorkflows } from "~/modules/queue/application/workflows";

import { writeNotebookGuide } from "../guide";
import { runNotebookResearch } from "../research";
import { runInfographic } from "../studio/infographic";
import { runNotebookStudio } from "../studio/run";

const notebookJob = defineTask<NotebookJobTaskData>({
  payload: notebookJobTaskDataSchema,
  handle: async (job, { env, message }) => {
    const context = await loadUserContext(env, message.user_id);

    if (!context) {
      return { status: "error", message: "A notebook job requires an owner" };
    }

    if (job.job === "guide") {
      const guide = await writeNotebookGuide(context, job.notebookId);

      return { status: "success", message: guide ? "Guide written" : "Nothing to summarise" };
    }

    if (job.job === "research") {
      await runNotebookResearch(context, job);

      return { status: "success", message: "Research imported" };
    }

    if (job.job === "infographic") {
      await runInfographic(context, job);

      return { status: "success", message: "Infographic drawn" };
    }

    const outcome = await runNotebookStudio(context, job);

    return {
      status: outcome === "failed" ? "error" : "success",
      message: `Studio output ${outcome}`,
    };
  },
});

export function registerNotebooksQueue(workflows: AppWorkflows): void {
  workflows.on(NOTEBOOK_JOB_TASK_TYPE, notebookJob);
}
