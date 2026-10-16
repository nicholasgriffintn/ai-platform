import { researchStatusSchema } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { createFunctionOutput } from "~/modules/outputs/application/run-with-output";
import { getResearchTaskStatus, startResearchTask } from "~/modules/research/application/task";

import type { JobKindDefinition } from "../../domain/job-kind";
import { requireScopedOutput } from "../outputs";
import { jobFields, jobStatusFromProvider, readJobContent } from "../present";

const RESEARCH_CAPABILITY = "research";

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readResearchData(content: Record<string, unknown>): Record<string, unknown> {
  return readRecord(readRecord(content.result).data);
}

function researchRunId(run: Record<string, unknown>): string {
  if (typeof run.run_id === "string") {
    return run.run_id;
  }

  return typeof run.research_id === "string" ? run.research_id : "";
}

export const researchJobs: JobKindDefinition<"research"> = {
  kind: "research",
  outputCapability: RESEARCH_CAPABILITY,
  async start(scope, input) {
    const handle = await startResearchTask({
      env: scope.context.env,
      user: scope.user,
      input: input.input,
      provider: input.provider,
      options: input.options,
    });
    const runId = researchRunId(readRecord(handle.run));
    const record = await createFunctionOutput(
      scope.context,
      scope.user.id,
      RESEARCH_CAPABILITY,
      { result: { status: "in_progress", data: { provider: handle.provider, run: handle.run } } },
      runId || undefined,
      scope.projectId,
    );
    const job = researchJobs.present(await requireScopedOutput(scope, record.id));

    return { jobs: job ? [job] : [], rejected: [] };
  },
  present(record) {
    if (record.capability_id !== RESEARCH_CAPABILITY) {
      return null;
    }

    const data = readResearchData(readJobContent(record));
    const run = readRecord(data.run);
    const status = jobStatusFromProvider(run.status);
    const error = typeof run.error === "string" ? run.error : null;

    const parsed = researchStatusSchema.partial().safeParse(data);

    return {
      ...jobFields(record),
      kind: "research",
      status: status === "succeeded" && data.output === undefined ? "in_progress" : status,
      result: parsed.success ? parsed.data : {},
      error,
    };
  },
  async refresh(scope, record) {
    const provider = readResearchData(readJobContent(record)).provider;

    if (!record.group_id || (provider !== "parallel" && provider !== "exa")) {
      return record;
    }

    await getResearchTaskStatus({
      env: scope.context.env,
      user: scope.user,
      runId: record.group_id,
      provider,
    });

    return requireScopedOutput(scope, record.id);
  },
};
