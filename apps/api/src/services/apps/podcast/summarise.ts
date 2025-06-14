import { gatewayId } from "~/constants/app";
import { RepositoryManager } from "~/repositories";
import type { IEnv, IFunctionResponse, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger();

function generateFullTranscription(
  transcription: {
    segments: { speaker: any; text: any }[];
  },
  speakers: {
    [name: string]: string;
  },
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

export interface IPodcastSummariseBody {
  podcastId: string;
  speakers: { [name: string]: string };
}

type SummariseRequest = {
  env: IEnv;
  request: IPodcastSummariseBody;
  user: IUser;
  app_url?: string;
};

export const handlePodcastSummarise = async (
  req: SummariseRequest,
): Promise<IFunctionResponse | IFunctionResponse[]> => {
  const { request, env, user } = req;

  if (!request.podcastId || !request.speakers) {
    throw new AssistantError(
      "Missing podcast id or speakers",
      ErrorType.PARAMS_ERROR,
    );
  }

  if (!env.DB) {
    throw new AssistantError("Missing database", ErrorType.PARAMS_ERROR);
  }

  try {
    if (!user?.id) {
      throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
    }

    const repositories = RepositoryManager.getInstance(env);

    const existingSummaries =
      await repositories.appData.getAppDataByUserAppAndItem(
        user.id,
        "podcasts",
        request.podcastId,
        "summary",
      );

    if (existingSummaries.length > 0) {
      let summaryData;
      try {
        summaryData = JSON.parse(existingSummaries[0].data);
      } catch (e) {
        logger.error("Failed to parse summary data", { error: e });
        summaryData = {};
      }
      return {
        status: "success",
        content: summaryData.summary,
        data: {
          summary: summaryData.summary,
          speakers: summaryData.speakers,
        },
      };
    }

    const transcriptionData =
      await repositories.appData.getAppDataByUserAppAndItem(
        user.id,
        "podcasts",
        request.podcastId,
        "transcribe",
      );

    if (transcriptionData.length === 0) {
      throw new AssistantError(
        "Transcription not found. Please transcribe podcast first",
        ErrorType.PARAMS_ERROR,
      );
    }

    let parsedTranscriptionData;
    try {
      parsedTranscriptionData = JSON.parse(transcriptionData[0].data);
    } catch (e) {
      logger.error("Failed to parse transcription data", { error: e });
      parsedTranscriptionData = {};
    }
    const title = parsedTranscriptionData.title;
    const description = parsedTranscriptionData.description;
    const transcription = parsedTranscriptionData.transcriptionData.output;

    const fullTranscription = generateFullTranscription(
      transcription,
      request.speakers,
    );

    if (!fullTranscription) {
      const appData = {
        summary: description,
        title,
        description,
        speakers: request.speakers,
        status: "complete",
        createdAt: new Date().toISOString(),
      };

      await repositories.appData.createAppDataWithItem(
        user.id,
        "podcasts",
        request.podcastId,
        "summary",
        appData,
      );

      return {
        status: "success",
        content: "No transcription found",
        data: appData,
      };
    }

    const data = await env.AI.run(
      "@cf/facebook/bart-large-cnn",
      {
        input_text: fullTranscription,
        max_length: 52,
      },
      {
        gateway: {
          id: gatewayId,
          skipCache: false,
          cacheTtl: 3360,
          metadata: {
            email: user?.email,
          },
        },
      },
    );

    if (!data.summary) {
      throw new AssistantError("No response from the model");
    }

    const appData = {
      summary: data.summary,
      title,
      description,
      speakers: request.speakers,
      status: "complete",
      createdAt: new Date().toISOString(),
    };

    await repositories.appData.createAppDataWithItem(
      user.id,
      "podcasts",
      request.podcastId,
      "summary",
      appData,
    );

    return {
      status: "success",
      content: data.summary,
      data: appData,
    };
  } catch (error) {
    console.error("Failed to summarize podcast:", error);
    throw new AssistantError("Failed to summarize podcast");
  }
};
