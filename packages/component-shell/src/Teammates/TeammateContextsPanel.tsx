import { Button, ButtonLink, Card } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  createTeammateConversationActionPath,
  getErrorMessage,
  useTeammateContexts,
} from "@ngriffin_uk/polychat-library-react";
import type { TeammateContextScope } from "@ngriffin_uk/polychat-schemas";
import { Archive, ExternalLink, Pause, Play } from "lucide-react";

import { TeammateComputerPanel } from "./TeammateComputerPanel.js";
import { TeammateConnectionGrantsPanel } from "./TeammateConnectionGrantsPanel.js";
import { TeammateMemoryPanel } from "./TeammateMemoryPanel.js";
import { TeammateRoutinesPanel } from "./TeammateRoutinesPanel.js";

export function TeammateContextsPanel({
  teammateId,
  projectId,
  conversationPath,
}: {
  teammateId: string;
  projectId?: string;
  conversationPath: (conversationId: string) => string;
}) {
  const userId = useChatStore((state) => state.user?.id);
  const { contexts, isLoading, error, ensure, updateStatus } = useTeammateContexts(teammateId);
  const scope: TeammateContextScope | null = projectId
    ? { type: "project", id: projectId }
    : userId
      ? { type: "personal", id: String(userId) }
      : null;
  const current = scope
    ? contexts.find((context) => context.scope.type === scope.type && context.scope.id === scope.id)
    : undefined;

  return (
    <Card className="mt-8 space-y-4 p-5 shadow-none">
      <div>
        <h2 className="font-semibold text-foreground">Working context</h2>
        <p className="text-sm text-muted-foreground">
          Keep this teammate’s conversation, routines, connections and memory together in this
          scope.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {getErrorMessage(error, "Could not load this teammate’s working context.")}
        </p>
      )}

      {current ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {current.scope.type === "project" ? "Project context" : "Personal context"}
            </p>
            <p className="text-xs text-muted-foreground">{current.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {current.status === "active" ? (
              <>
                <ButtonLink
                  href={createTeammateConversationActionPath(
                    conversationPath(current.homeConversationId),
                    teammateId,
                  )}
                  size="sm"
                  variant="outline"
                  icon={<ExternalLink className="size-4" />}
                >
                  Open teammate
                </ButtonLink>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<Pause className="size-4" />}
                  isLoading={updateStatus.isPending}
                  onClick={() =>
                    void updateStatus.mutateAsync({ contextId: current.id, status: "paused" })
                  }
                >
                  Pause
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Play className="size-4" />}
                isLoading={updateStatus.isPending}
                onClick={() =>
                  void updateStatus.mutateAsync({ contextId: current.id, status: "active" })
                }
              >
                Reactivate
              </Button>
            )}
            {current.status !== "archived" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Archive className="size-4" />}
                isLoading={updateStatus.isPending}
                onClick={() =>
                  void updateStatus.mutateAsync({ contextId: current.id, status: "archived" })
                }
              >
                Archive
              </Button>
            ) : null}
          </div>
          {current.status !== "archived" ? (
            <>
              <div className="basis-full">
                <TeammateConnectionGrantsPanel contextId={current.id} />
              </div>
              <div className="basis-full">
                <TeammateMemoryPanel contextId={current.id} />
              </div>
              <div className="basis-full">
                <TeammateRoutinesPanel contextId={current.id} projectId={projectId} />
              </div>
              <div className="basis-full">
                <TeammateComputerPanel contextId={current.id} />
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={!scope || isLoading}
          isLoading={ensure.isPending}
          onClick={() => {
            if (scope) {
              void ensure.mutateAsync({ teammateId, scope });
            }
          }}
        >
          Start working context
        </Button>
      )}
    </Card>
  );
}
