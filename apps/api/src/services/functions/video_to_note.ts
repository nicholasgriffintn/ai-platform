import type { IFunction, IRequest } from "~/types";
import { AssistantError, ErrorType } from "../../utils/errors";
import { handleVideoToNotes } from "../video/notes";

export const video_to_note: IFunction = {
  name: "video_to_note",
  description:
    "Extracts audio from a video URL (e.g., YouTube), transcribes it, and generates structured notes.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Publicly accessible video URL (YouTube, Vimeo, or direct link)",
      },
      timestamps: {
        type: "boolean",
        description: "Include timestamps in the transcript if supported",
      },
      provider: {
        type: "string",
        description: "Transcription provider to use",
        enum: ["workers", "mistral"],
      },
      generateSummary: {
        type: "boolean",
        description: "Generate AI-powered notes from transcript",
        default: true,
      },
    },
    required: ["url"],
  },
  type: "premium",
  costPerCall: 1,
  function: async (
    _completion_id: string,
    args: any,
    req: IRequest,
    _app_url?: string,
  ) => {
    if (!args?.url || typeof args.url !== "string") {
      throw new AssistantError("A valid 'url' is required", ErrorType.PARAMS_ERROR);
    }

    const response = await handleVideoToNotes({
      env: req.env,
      user: req.user,
      url: args.url,
      timestamps: args.timestamps === true,
      provider: args.provider,
      generateSummary: args.generateSummary !== false,
    });

    return response;
  },
};