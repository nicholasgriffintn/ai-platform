import {
  Button,
  OptionsMenu,
  OptionsMenuAction,
  OptionsMenuSeparator,
  OptionsMenuSubmenu,
} from "@ngriffin_uk/polychat-component-ui";
import type { SourceCollection } from "@ngriffin_uk/polychat-schemas";
import {
  ExternalLink,
  Folder,
  FolderPlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import type { FileItem } from "./file-items.js";
import type { FileActions } from "./useFileActions.js";

function hasMenuItems(item: FileItem): boolean {
  return (
    Boolean(item.downloadUrl) ||
    item.origin === "output" ||
    item.canRename ||
    item.canMoveToFolder ||
    item.canDelete
  );
}

export function FileItemMenuItems({
  item,
  actions,
  folders,
}: {
  item: FileItem;
  actions: FileActions;
  folders: SourceCollection[];
}) {
  const generalFolders = folders.filter((folder) => folder.kind === "general");
  const hasLinks = Boolean(item.downloadUrl) || item.origin === "output";
  const hasEdits = item.canRename || item.canMoveToFolder;

  return (
    <>
      {item.downloadUrl ? (
        <OptionsMenuAction
          onSelect={() => window.open(item.downloadUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={14} aria-hidden="true" />
          Open file
        </OptionsMenuAction>
      ) : null}
      {item.origin === "output" ? (
        <OptionsMenuAction onSelect={() => void actions.copyShareLink(item)}>
          <Link2 size={14} aria-hidden="true" />
          Copy share link
        </OptionsMenuAction>
      ) : null}
      {hasLinks && hasEdits ? <OptionsMenuSeparator /> : null}
      {item.canRename ? (
        <OptionsMenuAction onSelect={() => actions.request("rename", item)}>
          <Pencil size={14} aria-hidden="true" />
          Rename
        </OptionsMenuAction>
      ) : null}
      {item.canMoveToFolder ? (
        <OptionsMenuSubmenu
          trigger={
            <span className="flex items-center gap-4">
              <Folder size={14} aria-hidden="true" />
              Add to folder
            </span>
          }
        >
          {generalFolders.map((folder) => (
            <OptionsMenuAction
              key={folder.id}
              onSelect={() =>
                void actions.moveToFolder(item, { folderId: folder.id }).catch(() => undefined)
              }
            >
              <Folder size={14} aria-hidden="true" />
              <span className="truncate">{folder.title}</span>
            </OptionsMenuAction>
          ))}
          {generalFolders.length ? <OptionsMenuSeparator /> : null}
          <OptionsMenuAction onSelect={() => actions.request("move", item)}>
            <FolderPlus size={14} aria-hidden="true" />
            New folder…
          </OptionsMenuAction>
        </OptionsMenuSubmenu>
      ) : null}
      {item.canDelete ? (
        <>
          {hasLinks || hasEdits ? <OptionsMenuSeparator /> : null}
          <OptionsMenuAction
            className="text-failure data-[highlighted]:text-failure"
            onSelect={() => actions.request("delete", item)}
          >
            <Trash2 size={14} aria-hidden="true" />
            {item.origin === "memory" ? "Forget" : "Delete"}
          </OptionsMenuAction>
        </>
      ) : null}
    </>
  );
}

export function FileItemMenu({
  item,
  actions,
  folders,
  className,
}: {
  item: FileItem;
  actions: FileActions;
  folders: SourceCollection[];
  className?: string;
}) {
  if (!hasMenuItems(item)) {
    return null;
  }

  return (
    <OptionsMenu
      align="end"
      trigger={
        <Button
          variant="icon"
          size="icon"
          icon={<MoreHorizontal size={16} />}
          aria-label={`More for ${item.title}`}
          className={className}
        />
      }
    >
      <FileItemMenuItems item={item} actions={actions} folders={folders} />
    </OptionsMenu>
  );
}
