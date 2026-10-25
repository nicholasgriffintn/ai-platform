import { Button, OptionsMenu, OptionsMenuAction, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  useKnowledgeSyncControl,
  type KnowledgeSyncTarget,
} from "@ngriffin_uk/polychat-library-react";
import type { KnowledgeSync } from "@ngriffin_uk/polychat-schemas";
import {
  Globe,
  MoreHorizontal,
  Newspaper,
  PauseCircle,
  Plug,
  Rss,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

const KIND_ICONS: Record<KnowledgeSync["kind"], LucideIcon> = {
  connector: Plug,
  rss: Rss,
  news: Newspaper,
  web: Globe,
};

function describeSync(sync: KnowledgeSync): string {
  const source = !sync.feed
    ? `${sync.resourceCount} resources`
    : sync.feed.kind === "rss"
      ? sync.feed.url
      : sync.feed.query;
  const freshness = sync.lastSuccessfulAt
    ? `last read ${new Date(sync.lastSuccessfulAt).toLocaleString()}`
    : "not read yet";

  return sync.status === "paused" ? `${source} · paused` : `${source} · ${freshness}`;
}

function SyncIcon({ sync }: { sync: KnowledgeSync }) {
  if (sync.lastError) {
    return <TriangleAlert className="size-4 text-failure" aria-label={sync.lastError} />;
  }

  const Icon = sync.status === "paused" ? PauseCircle : KIND_ICONS[sync.kind];

  return <Icon className="size-4" aria-hidden="true" />;
}

export function KnowledgeSyncList({
  target,
  syncs,
}: {
  target: KnowledgeSyncTarget;
  syncs: readonly KnowledgeSync[];
}) {
  const control = useKnowledgeSyncControl(target);

  return (
    <ul className="flex flex-col gap-0.5">
      {syncs.map((sync) => (
        <li
          key={sync.id}
          className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-selection"
        >
          <span className="shrink-0 text-muted-foreground">
            <SyncIcon sync={sync} />
          </span>
          <span className="min-w-0 flex-1" title={sync.lastError ?? describeSync(sync)}>
            <span
              className={cn(
                "block truncate text-sm",
                sync.status === "paused" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {sync.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {sync.lastError ?? describeSync(sync)}
            </span>
          </span>
          {sync.canManage ? (
            <OptionsMenu
              align="end"
              trigger={
                <Button
                  variant="icon"
                  size="icon"
                  icon={<MoreHorizontal size={16} />}
                  aria-label={`More for ${sync.title}`}
                  disabled={control.isPending}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                />
              }
            >
              <OptionsMenuAction
                onSelect={() => control.mutate({ id: sync.id, action: "refresh" })}
              >
                Read now
              </OptionsMenuAction>
              <OptionsMenuAction
                onSelect={() =>
                  control.mutate({
                    id: sync.id,
                    action: sync.status === "active" ? "pause" : "resume",
                  })
                }
              >
                {sync.status === "active" ? "Pause" : "Resume"}
              </OptionsMenuAction>
              <OptionsMenuAction onSelect={() => control.mutate({ id: sync.id, action: "remove" })}>
                Stop following
              </OptionsMenuAction>
            </OptionsMenu>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
