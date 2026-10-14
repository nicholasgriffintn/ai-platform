import type {
  ChannelBinding,
  ChannelPairingChallenge,
  ChannelSender,
  CreateChannelBindingInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { resource } from "./resource.js";

export function listChannelBindings(): Promise<ChannelBinding[]> {
  return resource<ChannelBinding>("/channels/bindings").listAll();
}

export async function createChannelBinding(
  input: CreateChannelBindingInput,
): Promise<ChannelBinding> {
  return returnFetchedData(
    await fetchApiOrThrow("/channels/bindings", {
      method: "POST",
      headers: await apiService.getHeaders(),
      body: input,
    }),
  );
}

export async function deleteChannelBinding(bindingId: string): Promise<void> {
  await fetchApiOrThrow(`/channels/bindings/${encodeURIComponent(bindingId)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}

export function listChannelSenders(bindingId: string): Promise<ChannelSender[]> {
  return resource<ChannelBinding>("/channels/bindings")
    .sub<ChannelSender>(bindingId, "senders")
    .listAll();
}

export async function issueChannelPairingChallenge(
  bindingId: string,
): Promise<ChannelPairingChallenge> {
  return returnFetchedData(
    await fetchApiOrThrow(
      `/channels/bindings/${encodeURIComponent(bindingId)}/pairing_challenges`,
      { method: "POST", headers: await apiService.getHeaders() },
    ),
  );
}

export async function revokeChannelSender(
  bindingId: string,
  senderId: string,
  expectedRevision: number,
): Promise<void> {
  await fetchApiOrThrow(
    `/channels/bindings/${encodeURIComponent(bindingId)}/senders/${encodeURIComponent(senderId)}?expected_revision=${expectedRevision}`,
    {
      method: "DELETE",
      headers: await apiService.getHeaders(),
    },
  );
}
