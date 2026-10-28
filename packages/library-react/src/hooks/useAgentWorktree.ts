import { desktopExecutionBackend } from "@ngriffin_uk/polychat-library-chat";
import { openBranchPullRequest } from "@ngriffin_uk/polychat-library-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const WORKTREE_QUERY_KEY = "agent-worktree";
const WORKTREE_CHANGES_QUERY_KEY = "agent-worktree-changes";

export function useAgentWorktree(conversationId: string | undefined, revision: number) {
  const backend = desktopExecutionBackend();
  const queryClient = useQueryClient();
  const binding = useQuery({
    queryKey: [WORKTREE_QUERY_KEY, conversationId, revision],
    enabled: Boolean(backend && conversationId),
    queryFn: async () => {
      if (!backend || !conversationId) {
        return null;
      }

      const thread = await backend.readAgentThread(conversationId);

      return thread
        ? {
            directoryId: thread.directoryId,
            worktree: await backend.agentWorktree(thread.directoryId, conversationId),
          }
        : null;
    },
  });
  const workspace = binding.data ?? null;
  const changes = useQuery({
    queryKey: [WORKTREE_CHANGES_QUERY_KEY, conversationId, workspace?.worktree?.path, revision],
    enabled: Boolean(backend && conversationId && workspace?.worktree),
    queryFn: async () => {
      const worktree = workspace?.worktree;

      if (!backend || !conversationId || !workspace || !worktree) {
        return null;
      }

      const snapshot = await backend.snapshotAgentWorkspace(workspace.directoryId, conversationId);

      return snapshot
        ? backend.agentTurnChanges(
            workspace.directoryId,
            conversationId,
            worktree.baseCommit,
            snapshot,
          )
        : null;
    },
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [WORKTREE_CHANGES_QUERY_KEY, conversationId] });
  const commit = useMutation({
    mutationFn: async (message: string) => {
      if (!backend || !conversationId || !workspace) {
        throw new Error("This conversation has no worktree on this desktop.");
      }

      return backend.commitAgentWorktree(workspace.directoryId, conversationId, message);
    },
    onSuccess: refresh,
  });
  const pullRequest = useMutation({
    mutationFn: async (request: { title: string; body: string }) => {
      if (!backend || !conversationId || !workspace) {
        throw new Error("This conversation has no worktree on this desktop.");
      }

      return openBranchPullRequest({
        changes: await backend.agentBranchChanges(workspace.directoryId, conversationId),
        title: request.title,
        body: request.body,
      });
    },
  });

  return {
    directoryId: workspace?.directoryId ?? null,
    worktree: workspace?.worktree ?? null,
    changes: changes.data ?? null,
    isLoading: binding.isLoading || changes.isLoading,
    error: binding.error ?? changes.error,
    refresh,
    commit,
    pullRequest,
  };
}
