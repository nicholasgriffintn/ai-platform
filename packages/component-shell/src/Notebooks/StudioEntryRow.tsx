import { Button } from "@ngriffin_uk/polychat-component-ui";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { LoaderCircle, StickyNote, TriangleAlert } from "lucide-react";

import { outputToFileItem, sourceToFileItem } from "../Files/Library/file-items.js";
import { FileTypeIcon } from "../Files/Library/FilePreview.js";
import type { StudioEntry } from "./studio-entries.js";
import { studioTileForOutputKind, studioTileForSource } from "./studio-kinds.js";

export function StudioEntryRow({
  entry,
  onOpen,
  onPromote,
}: {
  entry: StudioEntry;
  onOpen: () => void;
  onPromote?: () => void;
}) {
  const item =
    entry.type === "output"
      ? outputToFileItem(entry.output, "")
      : sourceToFileItem(entry.source, "");
  const tile =
    entry.type === "output"
      ? studioTileForOutputKind(entry.output.kind)
      : entry.isNote
        ? undefined
        : studioTileForSource(entry.source);
  const Icon = entry.type === "source" && entry.isNote ? StickyNote : tile?.icon;
  const label = entry.type === "source" && entry.isNote ? "Note" : (tile?.label ?? item.detail);
  const title = entry.type === "output" ? entry.output.title : entry.source.title;

  return (
    <li className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-selection">
      <span className="shrink-0 text-muted-foreground">
        {item.status === "processing" ? (
          <LoaderCircle className="size-4 animate-spin" aria-label="Being made" />
        ) : item.status === "failed" ? (
          <TriangleAlert className="size-4 text-failure" aria-label="Could not be made" />
        ) : Icon ? (
          <Icon className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <FileTypeIcon type={item.type} />
        )}
      </span>
      <button
        type="button"
        onClick={onOpen}
        disabled={item.status === "processing"}
        className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default"
      >
        <span className="block truncate text-sm text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.status === "processing"
            ? `${label} · being made`
            : item.status === "failed"
              ? `${label} · could not be made`
              : `${label} · ${formatRelativeTime(entry.at)}`}
        </span>
      </button>
      {onPromote ? (
        <Button
          variant="outline"
          size="xs"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={onPromote}
        >
          Use as source
        </Button>
      ) : null}
    </li>
  );
}
