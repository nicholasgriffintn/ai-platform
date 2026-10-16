import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { recordingNotesSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { ai } from "~/infrastructure/ai";
import {
  resolveServiceContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { createExecutionOutputProvenance } from "~/modules/outputs/application/provenance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import type { IEnv, IFunctionResponse, IUser } from "~/types";

const logger = getLogger({ prefix: "services/apps/recording/summarise" });

function generateFullTranscription(
  transcription: {
    segments: { speaker: any; text: any }[];
  },
  speakers: Record<string, string>,
) {
  if (!transcription?.segments || !speakers) {
    return "";
  }

  const fullTranscription = transcription.segments
    .map((segment: any) => {
      const speaker = speakers[segment.speaker];

      return `${speaker}: ${segment.text}`;
    })
    .join("\n");

  return fullTranscription;
}

export interface IRecordingSummariseBody {
  recordingId: string;
  speakers: Record<string, string>;
}

type SummariseRequest = {
  context?: ServiceContext;
  env?: IEnv;
  request: IRecordingSummariseBody;
  user: IUser;
  app_url?: string;
  projectId?: string;
};

export const handleRecordingSummarise = async (
  req: SummariseRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { request, context, env, user, projectId } = req;

  if (!request.recordingId || !request.speakers) {
    throw new AssistantError("Missing recording id or speakers", ErrorType.PARAMS_ERROR);
  }

  try {
    if (!user?.id) {
      throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
    }

    const serviceContext = resolveServiceContext({ context, env, user });

    serviceContext.ensureDatabase();
    const repositories = serviceContext.repositories;
    const runtimeEnv = serviceContext.env;

    const existingSummaries = projectId
      ? await repositories
          .get(OutputRepository)
          .listProjectOutputGroup(projectId, "recordings", request.recordingId, "summary")
      : await repositories
          .get(OutputRepository)
          .listPersonalOutputGroup(user.id, "recordings", request.recordingId, "summary");

    if (existingSummaries.length > 0) {
      const summaryData = safeParseJson<Record<string, any>>(existingSummaries[0].content) ?? {};

      return {
        status: "success",
        content: summaryData.summary,
        data: {
          summary: summaryData.summary,
          decisions: summaryData.decisions,
          actionItems: summaryData.actionItems,
          speakers: summaryData.speakers,
        },
      };
    }

    const transcriptionData = projectId
      ? await repositories
          .get(OutputRepository)
          .listProjectOutputGroup(projectId, "recordings", request.recordingId, "transcribe")
      : await repositories
          .get(OutputRepository)
          .listPersonalOutputGroup(user.id, "recordings", request.recordingId, "transcribe");

    if (transcriptionData.length === 0) {
      throw new AssistantError(
        "Transcription not found. Please transcribe recording first",
        ErrorType.PARAMS_ERROR,
      );
    }

    const parsedTranscriptionData =
      safeParseJson<Record<string, any>>(transcriptionData[0].content) ?? {};
    const title = parsedTranscriptionData.title;
    const description = parsedTranscriptionData.description;
    const transcription = parsedTranscriptionData.transcriptionData.output;

    const fullTranscription = generateFullTranscription(transcription, request.speakers);

    if (!fullTranscription) {
      const appData = {
        summary: description,
        title,
        description,
        speakers: request.speakers,
        status: "complete",
        createdAt: new Date().toISOString(),
      };

      await repositories.get(OutputRepository).createOutput({
        createdByUserId: user.id,
        projectId,
        capabilityId: "recordings",
        groupId: request.recordingId,
        kind: "summary",
        title: `Summary: ${title || "Untitled recording"}`,
        content: appData,
      });

      return {
        status: "success",
        content: "No transcription found",
        data: appData,
      };
    }

    const { model, provider, effort } = await getAuxiliaryModel(runtimeEnv, user);
    const { object: notes } = await ai.generateObject({
      env: runtimeEnv,
      user,
      model,
      provider,
      reasoning_effort: effort,
      disable_functions: true,
      name: "recording_notes",
      schema: recordingNotesSchema,
      system: getPromptText("apps/recordings/notes"),
      prompt: fullTranscription,
    });

    const appData = {
      summary: notes.summary,
      decisions: notes.decisions,
      actionItems: notes.actionItems,
      title,
      description,
      speakers: request.speakers,
      status: "complete",
      createdAt: new Date().toISOString(),
    };

    await repositories.get(OutputRepository).createOutput({
      createdByUserId: user.id,
      projectId,
      capabilityId: "recordings",
      groupId: request.recordingId,
      kind: "summary",
      title: `Summary: ${title || "Untitled recording"}`,
      content: appData,
      provenance: await createExecutionOutputProvenance(serviceContext, {
        modelId: model,
        provider,
      }),
    });

    return {
      status: "success",
      content: notes.summary,
      data: appData,
    };
  } catch (error) {
    logger.error("Failed to summarize recording:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new AssistantError("Failed to summarize recording");
  }
};
