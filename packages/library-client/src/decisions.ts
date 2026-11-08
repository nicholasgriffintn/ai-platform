import type {
  DecisionRequest,
  DecisionResponse,
  PolisDecisionRequest,
  PolisDecisionResponse,
  PolisDraftRequest,
  PolisLawDraft,
  PolisRecording,
  PolisScenarioDraft,
  PolisShare,
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

const POLIS_PATH = "/experiences/polis";

export const polisService = {
  share(recording: PolisRecording, projectId?: string): Promise<PolisShare> {
    return postJson(withProjectScope(`${POLIS_PATH}/shares`, projectId), recording);
  },
  async stopSharing(token: string): Promise<PolisShare> {
    const response = await fetchApiOrThrow(`${POLIS_PATH}/shares/${encodeURIComponent(token)}`, {
      method: "DELETE",
    });

    return returnFetchedData<PolisShare>(response);
  },
  async shared(token: string): Promise<PolisRecording> {
    const response = await fetchApiOrThrow(`${POLIS_PATH}/shared/${encodeURIComponent(token)}`);

    return returnFetchedData<PolisRecording>(response);
  },
  decide(request: PolisDecisionRequest, projectId?: string): Promise<PolisDecisionResponse> {
    return postJson(
      withProjectScope(`${POLIS_PATH}/decisions`, projectId),
      request,
      MEDIA_DECISION_TIMEOUT_MS,
    );
  },
  draftLaw(request: PolisDraftRequest, projectId?: string): Promise<PolisLawDraft> {
    return postJson(
      withProjectScope(`${POLIS_PATH}/laws`, projectId),
      request,
      MEDIA_DECISION_TIMEOUT_MS,
    );
  },
  draftScenario(request: PolisDraftRequest, projectId?: string): Promise<PolisScenarioDraft> {
    return postJson(
      withProjectScope(`${POLIS_PATH}/scenarios`, projectId),
      request,
      MEDIA_DECISION_TIMEOUT_MS,
    );
  },
};
