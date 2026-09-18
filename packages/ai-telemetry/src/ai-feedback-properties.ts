import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import type { AiFeedbackRating, TelemetryProperties } from "./types.js";

type AiFeedbackPropertiesInput = {
  surveyId: string;
  submissionId: string;
  traceId: string;
  feedback: AiFeedbackRating;
  logId?: string;
  messageId?: string;
  conversationId?: string;
  properties?: TelemetryProperties;
};

export function buildAiFeedbackProperties(input: AiFeedbackPropertiesInput): TelemetryProperties {
  return {
    ...omitNullishValues({
      $survey_id: input.surveyId,
      $survey_response: input.feedback === 1 ? "1" : "2",
      $survey_completed: true,
      $survey_submission_id: input.submissionId,
      $ai_trace_id: input.traceId,
      log_id: input.logId,
      message_id: input.messageId,
      conversation_id: input.conversationId,
    }),
    ...input.properties,
  };
}
