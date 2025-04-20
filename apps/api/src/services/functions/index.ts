import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunction, IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { extract_content } from "./extract_content";
import { create_image } from "./image";
import { create_music } from "./music";
import { prompt_coach } from "./prompt_coach";
import { capture_screenshot } from "./screenshot";
import { create_speech } from "./speech";
import { tutor } from "./tutor";
import { create_video } from "./video";
import { get_weather } from "./weather";
import { web_search } from "./web_search";

export const availableFunctions: IFunction[] = [
  get_weather,
  create_video,
  create_music,
  create_image,
  web_search,
  extract_content,
  capture_screenshot,
  create_speech,
  tutor,
  prompt_coach,
];

export const handleFunctions = async ({
  completion_id,
  app_url,
  functionName,
  args,
  request,
  conversationManager,
}: {
  completion_id: string;
  app_url: string | undefined;
  functionName: string;
  args: unknown;
  request: IRequest;
  conversationManager?: ConversationManager;
}): Promise<IFunctionResponse> => {
  const foundFunction = availableFunctions.find(
    (func) => func.name === functionName,
  );

  if (!foundFunction) {
    throw new AssistantError(
      `Function ${functionName} not found`,
      ErrorType.PARAMS_ERROR,
    );
  }

  return foundFunction.function(
    completion_id,
    args,
    request,
    app_url,
    conversationManager,
  );
};
