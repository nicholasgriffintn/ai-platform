import type {
  DecisionRequest,
  DecisionResponse,
  TwentyQuestionsAnswer,
  TwentyQuestionsAskRequest,
  TwentyQuestionsCategory,
  TwentyQuestionsGame,
  TwentyQuestionsReveal,
  VerbatimStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import { readServerSentEvents } from "@ngriffin_uk/polychat-utility-core";

import { fetchApi, fetchApiOrThrow } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";
import { withProjectScope } from "./project-scope.js";

const MEDIA_DECISION_TIMEOUT_MS = 60_000;

async function postJson<T>(path: string, body: object, timeoutMs?: number): Promise<T> {
  const response = await fetchApiOrThrow(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    timeoutMs,
  });

  return returnFetchedData<T>(response);
}

export const decisionsService = {
  decide(request: DecisionRequest): Promise<DecisionResponse> {
    return postJson<DecisionResponse>("/decisions", request, MEDIA_DECISION_TIMEOUT_MS);
  },
};

export const verbatimService = {
  async streamSegment(
    audio: Blob,
    context: string,
    onEvent: (event: VerbatimStreamEvent) => void,
    projectId?: string,
  ): Promise<void> {
    const form = new FormData();

    form.append("audio", new File([audio], "segment.wav", { type: "audio/wav" }));

    if (context) {
      form.append("context", context);
    }

    const response = await fetchApi(withProjectScope("/experiences/verbatim/segments", projectId), {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      body: form,
      timeoutMs: MEDIA_DECISION_TIMEOUT_MS,
    });

    if (!response.ok || !response.body) {
      throw await createApiErrorFromResponse(response, "This phrase could not be checked");
    }

    await readServerSentEvents<VerbatimStreamEvent>(response.body, { onEvent });
  },
};

const TWENTY_QUESTIONS_PATH = "/experiences/twenty_questions";

export const twentyQuestionsService = {
  start(category: TwentyQuestionsCategory, projectId?: string): Promise<TwentyQuestionsGame> {
    return postJson(withProjectScope(TWENTY_QUESTIONS_PATH, projectId), { category });
  },
  ask(request: TwentyQuestionsAskRequest, projectId?: string): Promise<TwentyQuestionsAnswer> {
    return postJson(withProjectScope(`${TWENTY_QUESTIONS_PATH}/ask`, projectId), request);
  },
  reveal(token: string, projectId?: string): Promise<TwentyQuestionsReveal> {
    return postJson(withProjectScope(`${TWENTY_QUESTIONS_PATH}/reveal`, projectId), { token });
  },
};
