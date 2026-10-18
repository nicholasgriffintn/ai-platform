import { Badge, Button, ButtonLink, SectionNav } from "@ngriffin_uk/polychat-component-ui";
import type { TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { Archive, Pause, Play, Settings2, X } from "lucide-react";

import { TeammateComputerPanel } from "./TeammateComputerPanel.js";
import { TeammateConnectionGrantsPanel } from "./TeammateConnectionGrantsPanel.js";
import { TeammateMemoryPanel } from "./TeammateMemoryPanel.js";
import { TeammateRoutinesPanel } from "./TeammateRoutinesPanel.js";

const STATUS_VARIANT = {
  active: "success",
  paused: "warning",
  archived: "secondary",
} as const;

export function TeammateDetailsPanel({
  context,
  projectId,
  settingsPath,
  isUpdating,
  onStatusChange,
  onClose,
}: {
  context: TeammateContext;
  projectId?: string;
  settingsPath: string;
  isUpdating: boolean;
  onStatusChange: (status: TeammateContext["status"]) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-labelledby="teammate-details-title"
      className="flex h-full min-h-0 flex-col border-l border-border bg-surface"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 id="teammate-details-title" className="text-sm font-semibold text-foreground">
          Details
        </h2>
        <Badge variant={STATUS_VARIANT[context.status]}>{context.status}</Badge>
        <Button
          type="button"
          variant="icon"
          className="ml-auto"
          onClick={onClose}
          aria-label="Close details"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        <ButtonLink
          href={settingsPath}
          size="sm"
          variant="outline"
          icon={<Settings2 className="size-4" />}
        >
          Configure
        </ButtonLink>
        {context.status === "active" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Pause className="size-4" />}
            isLoading={isUpdating}
            onClick={() => onStatusChange("paused")}
          >
            Pause
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<Play className="size-4" />}
            isLoading={isUpdating}
            onClick={() => onStatusChange("active")}
          >
            Reactivate
          </Button>
        )}
        {context.status !== "archived" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={<Archive className="size-4" />}
            isLoading={isUpdating}
            onClick={() => onStatusChange("archived")}
          >
            Archive
          </Button>
        ) : null}
      </div>
      {context.status === "active" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-border px-4 py-3">
            <SectionNav
              label="Teammate details"
              sections={[
                { id: "routines", label: "Routines" },
                { id: "memory", label: "Memory" },
                { id: "computer", label: "Computer" },
                { id: "connections", label: "Connections" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div id="routines" className="min-w-0 scroll-mt-6">
              <TeammateRoutinesPanel contextId={context.id} projectId={projectId} />
            </div>
            <div id="memory" className="min-w-0 scroll-mt-6">
              <TeammateMemoryPanel contextId={context.id} />
            </div>
            <div id="computer" className="min-w-0 scroll-mt-6">
              <TeammateComputerPanel contextId={context.id} />
            </div>
            <div id="connections" className="min-w-0 scroll-mt-6">
              <TeammateConnectionGrantsPanel contextId={context.id} />
            </div>
          </div>
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {context.status === "paused"
            ? "Paused. Reactivate to manage routines, memory, the computer and connections."
            : "Archived. Reactivate to pick up where you left off."}
        </p>
      )}
    </aside>
  );
}
