import {
  speechModelListResponseSchema,
  type SavedSpeechVoice,
  type SpeechModelOption,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export const speechVoicesService = {
  async listModels(): Promise<SpeechModelOption[]> {
    const response = await fetchApiOrThrow("/audio/speech/models", { method: "GET" });

    return speechModelListResponseSchema.parse(await returnFetchedData<unknown>(response)).models;
  },
  async create({
    name,
    sample,
    consent,
  }: {
    name: string;
    sample: File;
    consent: true;
  }): Promise<SavedSpeechVoice> {
    const form = new FormData();

    form.append("name", name);
    form.append("sample", sample);
    form.append("consent", String(consent));

    const response = await fetchApiOrThrow("/audio/voices", {
      method: "POST",
      body: form,
      timeoutMs: null,
    });

    return (await returnFetchedData<{ voice: SavedSpeechVoice }>(response)).voice;
  },
  async delete(voiceId: string): Promise<void> {
    await fetchApiOrThrow(`/audio/voices/${encodeURIComponent(voiceId)}`, {
      method: "DELETE",
    });
  },
};
