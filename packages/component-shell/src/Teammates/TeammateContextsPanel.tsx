import { Badge, Button, ButtonLink, Card, SectionNav } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  createTeammateConversationActionPath,
  useTeammateContexts,
} from "@ngriffin_uk/polychat-library-react";
import type { TeammateContextScope } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { Archive, ExternalLink, Pause, Play, Workflow } from "lucide-react";

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
  const statusVariant =
    current?.status === "active"
      ? "success"
      : current?.status === "paused"
        ? "warning"
        : "secondary";

  return (
    <section className="space-y-5" aria-labelledby="working-context-title">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-creative/12 p-2.5 text-creative">
          <Workflow className="size-5" />
        </div>
        <div>
          <h2 id="working-context-title" className="font-semibold text-foreground">
            Working context
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            A persistent workspace for this teammate’s home conversation, memory, routines,
            connections and computer. It is scoped to the place you are managing it from.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(error, "Could not load this teammate’s working context.")}
        </p>
      )}

      {current ? (
        <Card className="gap-0 overflow-hidden p-0 shadow-none">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {current.scope.type === "project"
                    ? "Project working context"
                    : "Personal working context"}
                </h3>
                <Badge variant={statusVariant}>{current.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {current.scope.type === "project"
                  ? "Shared by your work in this project."
                  : "Private to your conversations with this teammate."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                The home conversation and resources below use this context.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {current.status === "active" ? (
                <>
                  <ButtonLink
                    href={createTeammateConversationActionPath(
                      conversationPath(current.homeConversationId),
                      teammateId,
                    )}
                    size="sm"
                    variant="primary"
                    icon={<ExternalLink className="size-4" />}
                  >
                    Open conversation
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
                  variant="primary"
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
          </div>

          {current.status === "active" ? (
            <>
              <div className="border-b border-border px-5 py-4">
                <SectionNav
                  label="Working context sections"
                  sections={[
                    { id: "memory", label: "Memory" },
                    { id: "connections", label: "Connections" },
                    { id: "routines", label: "Routines" },
                    { id: "computer", label: "Computer" },
                  ]}
                />
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div id="memory" className="scroll-mt-6 md:col-span-2">
                  <TeammateMemoryPanel contextId={current.id} />
                </div>
                <div id="connections" className="scroll-mt-6">
                  <TeammateConnectionGrantsPanel contextId={current.id} />
                </div>
                <div id="routines" className="scroll-mt-6">
                  <TeammateRoutinesPanel contextId={current.id} projectId={projectId} />
                </div>
                <div id="computer" className="scroll-mt-6 md:col-span-2">
                  <TeammateComputerPanel contextId={current.id} />
                </div>
              </div>
            </>
          ) : (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">
                {current.status === "paused"
                  ? "Reactivate this context to manage its memory, connections, routines and computer."
                  : "This context is archived. Reactivate it to resume working with this teammate."}
              </p>
            </div>
          )}
        </Card>
      ) : (
        <Card className="gap-5 p-6 shadow-none">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-surface-elevated p-2.5 text-muted-foreground">
              <Workflow className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Start a working context</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Give this teammate a persistent home conversation and a place to keep memory,
                routines, connection access and computer work for this scope.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="w-fit"
            variant="primary"
            icon={<Play className="size-4" />}
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
        </Card>
      )}
    </section>
  );
}
