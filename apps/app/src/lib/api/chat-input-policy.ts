import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  ChatInputPolicyState,
  UpdateChatInputPolicy,
  PreviewChatInputPolicy,
  ChatInputPolicyPreview,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

function policyPath(projectId?: string) {
  return projectId
    ? `/projects/${encodeURIComponent(projectId)}/chat-input-policy`
    : "/user/chat-input-policy";
}

export async function getChatInputPolicy(projectId?: string): Promise<ChatInputPolicyState> {
  return returnFetchedData(
    await fetchApiOrThrow(policyPath(projectId), {
      method: "GET",
      headers: await apiService.getHeaders(),
    }),
  );
}

export async function saveChatInputPolicy(
  input: UpdateChatInputPolicy,
  projectId?: string,
): Promise<ChatInputPolicyState> {
  return returnFetchedData(
    await fetchApiOrThrow(policyPath(projectId), {
      method: "PUT",
      headers: await apiService.getHeaders(),
      body: input,
    }),
  );
}

export async function previewChatInputPolicy(
  input: PreviewChatInputPolicy,
  projectId?: string,
): Promise<ChatInputPolicyPreview> {
  return returnFetchedData(
    await fetchApiOrThrow(`${policyPath(projectId)}/preview`, {
      method: "POST",
      headers: await apiService.getHeaders(),
      body: input,
    }),
  );
}
