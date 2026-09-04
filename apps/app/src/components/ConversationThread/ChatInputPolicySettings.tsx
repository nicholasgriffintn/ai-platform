import { ChatInputPolicyPanel } from "@ngriffin_uk/polychat-component-account";
import type { ChatInputPolicy, PreviewChatInputPolicy } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getChatInputPolicy,
  saveChatInputPolicy,
  previewChatInputPolicy,
} from "~/lib/api/chat-input-policy";
import { useChatStore } from "~/state/stores/chatStore";

export function ChatInputPolicySettings({
  projectId,
  canManage = true,
}: {
  projectId?: string;
  canManage?: boolean;
}) {
  const userId = useChatStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ["chat-input-policy", userId, projectId ?? "personal"];
  const query = useQuery({ queryKey, queryFn: () => getChatInputPolicy(projectId) });
  const save = useMutation({
    mutationFn: (policy: ChatInputPolicy) =>
      saveChatInputPolicy({ expectedRevision: query.data?.revision ?? 0, policy }, projectId),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKey, state);
    },
  });
  const preview = useMutation({
    mutationFn: (input: PreviewChatInputPolicy) => previewChatInputPolicy(input, projectId),
  });

  if (query.error) {
    return (
      <p role="alert" className="p-5 text-sm text-red-700">
        {query.error.message}
      </p>
    );
  }

  if (!query.data) {
    return <p className="p-5 text-sm text-zinc-500">Loading chat input policy…</p>;
  }

  return (
    <ChatInputPolicyPanel
      key={`${projectId ?? "personal"}:${query.data.revision}`}
      state={query.data}
      canManage={canManage}
      isSaving={save.isPending}
      isPreviewing={preview.isPending}
      errorMessage={save.error?.message ?? preview.error?.message}
      preview={preview.data}
      onReload={() => {
        save.reset();
        preview.reset();
        void query.refetch();
      }}
      onSave={(policy) => save.mutate(policy)}
      onPreview={(policy, content) => preview.mutate({ policy, content })}
    />
  );
}
