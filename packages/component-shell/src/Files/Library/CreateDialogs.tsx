import { Button, FormCheckbox, FormDialog, FormInput } from "@ngriffin_uk/polychat-component-ui";
import {
  getFilesPath,
  useMemoryDocuments,
  useSourceMutations,
} from "@ngriffin_uk/polychat-library-react";
import type { SourceCollection } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, slugify } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { NewEpisodeDialog } from "../Sources/NewEpisodeDialog.js";
import { FollowDialog } from "./FollowDialog.js";
import { ImportMemoryDialog } from "./ImportMemoryDialog.js";
import type { FileCreation } from "./useFileCreation.js";

interface DialogProps {
  basePath: string;
  projectId?: string;
  onClose: () => void;
}

async function withFailureToast(work: () => Promise<void>, failure: string) {
  try {
    await work();
  } catch (error) {
    toast.error(getErrorMessage(error, failure));
    throw error;
  }
}

function MemoryDialog({
  basePath,
  projectId,
  onClose,
  onImport,
}: DialogProps & { onImport: () => void }) {
  const navigate = useNavigate();
  const { create } = useMemoryDocuments(projectId);
  const [label, setLabel] = useState("");
  const name = slugify(label, 64);

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New memory"
      description="A document Polychat keeps in mind, such as how you like things written or who is who."
      submitText="Start writing"
      isLoading={create.isPending}
      submitDisabled={!name}
      onSubmit={() =>
        withFailureToast(async () => {
          await create.mutateAsync({ name, content: "", ...(projectId ? { projectId } : {}) });
          onClose();
          void navigate(getFilesPath(basePath, "memory", encodeURIComponent(name)));
        }, "Could not start this memory")
      }
    >
      <FormInput
        label="Name"
        value={label}
        placeholder="How we write"
        description={name ? `Saved as ${name}` : "Polychat refers to it by this name."}
        onChange={(event) => setLabel(event.target.value)}
      />
      {projectId ? null : (
        <Button type="button" variant="link" size="sm" onClick={onImport}>
          Bring memory over from another assistant
        </Button>
      )}
    </FormDialog>
  );
}

function FolderDialog({ basePath, projectId, onClose }: DialogProps) {
  const navigate = useNavigate();
  const mutations = useSourceMutations();
  const [title, setTitle] = useState("");
  const [isShow, setIsShow] = useState(false);

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New folder"
      submitText="Create folder"
      isLoading={mutations.createCollection.isPending}
      submitDisabled={!title.trim()}
      onSubmit={() =>
        withFailureToast(async () => {
          const folder = await mutations.createCollection.mutateAsync({
            projectId,
            title: title.trim(),
            kind: isShow ? "podcast" : "general",
          });

          onClose();
          void navigate(getFilesPath(basePath, "folders", encodeURIComponent(folder.id)));
        }, "Could not create the folder")
      }
    >
      <FormInput
        label="Name"
        value={title}
        maxLength={120}
        placeholder={isShow ? "Morning briefing" : "Quarterly planning"}
        onChange={(event) => setTitle(event.target.value)}
      />
      <FormCheckbox
        label="Podcast show"
        labelPosition="right"
        description="Episodes published to it get a private RSS feed for any podcast app."
        checked={isShow}
        onCheckedChange={setIsShow}
      />
    </FormDialog>
  );
}

export function CreateDialogs({
  basePath,
  projectId,
  creation,
  folders,
  showId,
}: {
  basePath: string;
  projectId?: string;
  creation: FileCreation;
  folders: SourceCollection[];
  showId?: string;
}) {
  const props = { basePath, projectId, onClose: creation.closeDialog };

  return (
    <>
      {creation.dialog === "memory" ? (
        <MemoryDialog {...props} onImport={() => creation.openDialog("memory-import")} />
      ) : null}
      {creation.dialog === "memory-import" && !projectId ? (
        <ImportMemoryDialog onClose={creation.closeDialog} />
      ) : null}
      {creation.dialog === "folder" ? <FolderDialog {...props} /> : null}
      {creation.dialog === "follow" ? (
        <FollowDialog projectId={projectId} onClose={creation.closeDialog} />
      ) : null}
      <NewEpisodeDialog
        open={creation.dialog === "podcast"}
        onOpenChange={(open) => !open && creation.closeDialog()}
        projectId={projectId}
        shows={folders.filter((folder) => folder.kind === "podcast")}
        defaultShowId={showId}
      />
    </>
  );
}
