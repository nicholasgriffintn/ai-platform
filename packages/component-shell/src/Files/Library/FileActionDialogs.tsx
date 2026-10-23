import { ConfirmationDialog, FormDialog, FormInput } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import type { FileItem } from "./file-items.js";
import type { FileActions } from "./useFileActions.js";

function RenameDialog({ item, actions }: { item: FileItem; actions: FileActions }) {
  const [title, setTitle] = useState(item.title);

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && actions.dismiss()}
      title="Rename"
      submitText="Rename"
      isLoading={actions.isWorking}
      submitDisabled={!title.trim() || title.trim() === item.title}
      onSubmit={() => actions.rename(item, title.trim())}
    >
      <FormInput
        label="Name"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
      />
    </FormDialog>
  );
}

function NewFolderDialog({ item, actions }: { item: FileItem; actions: FileActions }) {
  const [title, setTitle] = useState("");

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && actions.dismiss()}
      title="New folder"
      description={`${item.title} goes in the new folder and stays in Files too.`}
      submitText="Create and add"
      isLoading={actions.isWorking}
      submitDisabled={!title.trim()}
      onSubmit={() => actions.moveToFolder(item, { newFolderTitle: title.trim() })}
    >
      <FormInput
        label="Folder name"
        value={title}
        maxLength={120}
        placeholder="Quarterly planning"
        onChange={(event) => setTitle(event.target.value)}
      />
    </FormDialog>
  );
}

function deleteDescription(item: FileItem): string {
  switch (item.origin) {
    case "folder":
      return `Delete the ${item.title} folder? Everything in it stays in Files.`;
    case "memory":
      return `Forget ${item.title}? Polychat stops using it, and its revisions go too.`;
    default:
      return `Delete ${item.title}? This cannot be undone.`;
  }
}

export function FileActionDialogs({ actions }: { actions: FileActions }) {
  const { pending } = actions;

  if (!pending) {
    return null;
  }

  if (pending.action === "rename") {
    return <RenameDialog key={pending.item.key} item={pending.item} actions={actions} />;
  }

  if (pending.action === "move") {
    return <NewFolderDialog key={pending.item.key} item={pending.item} actions={actions} />;
  }

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => !open && actions.dismiss()}
      title={pending.item.origin === "memory" ? "Forget memory" : "Delete"}
      description={deleteDescription(pending.item)}
      confirmText={pending.item.origin === "memory" ? "Forget it" : "Delete"}
      variant="destructive"
      isLoading={actions.isWorking}
      onConfirm={() => actions.remove(pending.item)}
    />
  );
}
