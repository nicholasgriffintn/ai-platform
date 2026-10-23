import { cn, Link } from "@ngriffin_uk/polychat-component-ui";
import type { FilesLayout } from "@ngriffin_uk/polychat-library-react";
import type { SourceCollection } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, parseTimestamp } from "@ngriffin_uk/polychat-utility-core";

import type { FileItem } from "./file-items.js";
import { FileItemMenu } from "./FileItemMenu.js";
import { FilePreview, FileTypeIcon } from "./FilePreview.js";
import type { FileActions } from "./useFileActions.js";

const STATUS_LABELS = { processing: "Working on it", failed: "Failed" } as const;

const coverLinkClassName =
  "font-medium text-foreground no-underline after:absolute after:inset-0 after:content-[''] hover:!no-underline focus-visible:outline-none";

interface CollectionProps {
  actions: FileActions;
  folders: SourceCollection[];
}

function ItemMeta({ item }: { item: FileItem }) {
  return (
    <p className="truncate text-xs text-muted-foreground">
      {item.status ? (
        <span className={cn(item.status === "failed" && "text-failure")}>
          {STATUS_LABELS[item.status]} ·{" "}
        </span>
      ) : null}
      {item.detail} ·{" "}
      <time dateTime={item.updatedAt} title={parseTimestamp(item.updatedAt).toLocaleString()}>
        {formatRelativeTime(item.updatedAt)}
      </time>
    </p>
  );
}

function FolderTile({ item, actions, folders }: CollectionProps & { item: FileItem }) {
  return (
    <li className="relative flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface py-2 pr-1 pl-3 transition-colors focus-within:border-border-strong hover:border-border-strong">
      <span className="text-muted-foreground">
        <FileTypeIcon type="folder" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className={cn(coverLinkClassName, "block truncate text-sm")}>
          {item.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
      </div>
      <FileItemMenu item={item} actions={actions} folders={folders} className="relative z-10" />
    </li>
  );
}

function GridCard({ item, actions, folders }: CollectionProps & { item: FileItem }) {
  return (
    <li className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors focus-within:border-border-strong hover:border-border-strong">
      <div className="aspect-[4/3] overflow-hidden border-b border-border bg-muted/40">
        <FilePreview item={item} variant="card" />
      </div>
      <div className="flex items-start gap-1 py-2.5 pr-1 pl-3">
        <div className="min-w-0 flex-1">
          <Link href={item.href} className={cn(coverLinkClassName, "line-clamp-2 text-sm")}>
            {item.title}
          </Link>
          <ItemMeta item={item} />
        </div>
        <FileItemMenu item={item} actions={actions} folders={folders} className="relative z-10" />
      </div>
    </li>
  );
}

function ListRow({ item, actions, folders }: CollectionProps & { item: FileItem }) {
  return (
    <li className="relative flex min-w-0 items-center gap-3 px-3 py-2 transition-colors focus-within:bg-selection hover:bg-selection">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/60">
        <FilePreview item={item} variant="thumbnail" />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className={cn(coverLinkClassName, "block truncate text-sm")}>
          {item.title}
        </Link>
        <ItemMeta item={item} />
      </div>
      <FileItemMenu item={item} actions={actions} folders={folders} className="relative z-10" />
    </li>
  );
}

export function FileCollection({
  items,
  folderItems,
  layout,
  actions,
  folders,
}: CollectionProps & {
  items: FileItem[];
  folderItems: FileItem[];
  layout: FilesLayout;
}) {
  return (
    <div className="space-y-6">
      {folderItems.length ? (
        <section aria-label="Folders">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folderItems.map((item) => (
              <FolderTile key={item.key} item={item} actions={actions} folders={folders} />
            ))}
          </ul>
        </section>
      ) : null}
      {items.length ? (
        layout === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <GridCard key={item.key} item={item} actions={actions} folders={folders} />
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {items.map((item) => (
              <ListRow key={item.key} item={item} actions={actions} folders={folders} />
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
