import { FormCheckbox, FormDialog, FormInput, Textarea } from "@ngriffin_uk/polychat-component-ui";
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

function NoteDialog({ projectId, onClose }: DialogProps) {
  const mutations = useSourceMutations();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="New note"
      description="Text Polychat can read and cite whenever it is useful."
      submitText="Add note"
      isLoading={mutations.createSource.isPending}
      submitDisabled={!title.trim() || !content.trim()}
      onSubmit={() =>
        withFailureToast(async () => {
          await mutations.createSource.mutateAsync({
            projectId,
            kind: "text",
            title: title.trim(),
            content: content.trim(),
            status: "available",
            metadata: {},
          });
          toast.success("Note added");
          onClose();
        }, "Could not add the note")
      }
    >
      <FormInput
        label="Title"
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <div className="space-y-1">
        <label htmlFor="files-note-content" className="text-sm font-medium">
          Content
        </label>
        <Textarea
          id="files-note-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-40"
          required
        />
      </div>
    </FormDialog>
  );
}

function MemoryDialog({ basePath, projectId, onClose }: DialogProps) {
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
      {creation.dialog === "note" ? <NoteDialog {...props} /> : null}
      {creation.dialog === "memory" ? <MemoryDialog {...props} /> : null}
      {creation.dialog === "folder" ? <FolderDialog {...props} /> : null}
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
