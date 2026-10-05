import {
  channelBindingSchema,
  createChannelBindingSchema,
  listChannelBindingsResponseSchema,
  updateChannelBindingSchema,
  type CreateChannelBindingInput,
  type UpdateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listChannelBindings() {
  const response = await fetchApiOrThrow("/channels/bindings", {
    headers: await apiService.getHeaders(),
  });

  return listChannelBindingsResponseSchema.parse(await returnFetchedData<unknown>(response));
}

export async function createChannelBinding(input: CreateChannelBindingInput) {
  const response = await fetchApiOrThrow("/channels/bindings", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: createChannelBindingSchema.parse(input),
  });

  return channelBindingSchema.parse(await returnFetchedData<unknown>(response));
}

export async function updateChannelBinding(id: string, input: UpdateChannelBindingInput) {
  const response = await fetchApiOrThrow(`/channels/bindings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await apiService.getHeaders(),
    body: updateChannelBindingSchema.parse(input),
  });

  return channelBindingSchema.parse(await returnFetchedData<unknown>(response));
}

export async function deleteChannelBinding(id: string): Promise<void> {
  await fetchApiOrThrow(`/channels/bindings/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
