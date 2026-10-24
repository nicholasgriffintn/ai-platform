import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormTextarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import {
  type useNotebookActions,
  useSourceMutations,
  useSources,
} from "@ngriffin_uk/polychat-library-react";
import type { NotebookDetail } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, toggleSetMember } from "@ngriffin_uk/polychat-utility-core";
import { Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { sourceToFileItem } from "../Files/Library/file-items.js";
import { FileTypeIcon } from "../Files/Library/FilePreview.js";
import { UploadInput } from "../Files/Library/UploadInput.js";
import { useFileCreation } from "../Files/Library/useFileCreation.js";

type NotebookActions = ReturnType<typeof useNotebookActions>;

function FromFiles({
  notebook,
  projectId,
  actions,
  onDone,
}: {
  notebook: NotebookDetail;
  projectId?: string;
  actions: NotebookActions;
  onDone: () => void;
}) {
  const { data: sources = [], isLoading } = useSources({ projectId });
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set());
  const linked = new Set(
    [...notebook.sources, ...notebook.notes, ...notebook.media].map((s) => s.id),
  );
  const candidates = sources.filter(
    (source) => !linked.has(source.id) && source.kind !== "memory" && source.status === "available",
  );

  const add = async () => {
    try {
      await actions.addSources.mutateAsync({ sourceIds: [...chosen] });
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "Those sources could not be added"));
    }
  };

  if (isLoading) {
    return <p className="py-6 text-sm text-muted-foreground">Rummaging through your files…</p>;
  }

  if (candidates.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Everything in Files is already here, or Files is empty. Upload something instead.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {candidates.map((source) => {
          const item = sourceToFileItem(source, "");

          return (
            <li key={source.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-selection">
                <Checkbox
                  checked={chosen.has(source.id)}
                  onCheckedChange={() =>
                    setChosen((current) => toggleSetMember(current, source.id))
                  }
                />
                <span className="text-muted-foreground">
                  <FileTypeIcon type={item.type} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{source.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        variant="primary"
        disabled={chosen.size === 0}
        isLoading={actions.addSources.isPending}
        onClick={() => void add()}
      >
        Add {chosen.size === 1 ? "1 source" : `${chosen.size} sources`}
      </Button>
    </div>
  );
}

function FromUpload({ projectId, actions }: { projectId?: string; actions: NotebookActions }) {
  const creation = useFileCreation({
    projectId,
    onUploaded: (sourceId) => actions.addSources.mutateAsync({ sourceIds: [sourceId] }),
  });

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <UploadInput creation={creation} />
      <p className="max-w-sm text-sm text-muted-foreground">
        PDFs, documents, spreadsheets, audio, video and images. Audio and video are transcribed so
        Polychat can read them.
      </p>
      <Button
        variant="secondary"
        icon={<Upload className="size-4" />}
        isLoading={creation.isUploading}
        onClick={creation.openUploadPicker}
      >
        Choose files
      </Button>
    </div>
  );
}

function FromWebsite({ actions, onDone }: { actions: NotebookActions; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const isValid = URL.canParse(url.trim());

  const add = async () => {
    try {
      await actions.addSources.mutateAsync({ results: [{ title: url.trim(), url: url.trim() }] });
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "That page could not be read"));
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <FormInput
        label="Web page"
        type="url"
        placeholder="https://"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        fullWidth
      />
      <Button
        type="submit"
        variant="primary"
        disabled={!isValid}
        isLoading={actions.addSources.isPending}
      >
        Add page
      </Button>
    </form>
  );
}

function FromText({
  projectId,
  actions,
  onDone,
}: {
  projectId?: string;
  actions: NotebookActions;
  onDone: () => void;
}) {
  const { createSource } = useSourceMutations();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const add = async () => {
    try {
      const source = await createSource.mutateAsync({
        projectId: projectId ?? null,
        kind: "text",
        title: title.trim() || "Pasted text",
        content,
        status: "available",
        metadata: {},
      });

      await actions.addSources.mutateAsync({ sourceIds: [source.id] });
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "That text could not be added"));
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <FormInput
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        fullWidth
      />
      <FormTextarea
        label="Text"
        rows={8}
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <Button
        type="submit"
        variant="primary"
        disabled={!content.trim()}
        isLoading={createSource.isPending || actions.addSources.isPending}
      >
        Add text
      </Button>
    </form>
  );
}

export function NotebookAddSourcesDialog({
  open,
  onOpenChange,
  notebook,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notebook: NotebookDetail;
  actions: NotebookActions;
}) {
  const projectId = notebook.scope.kind === "project" ? notebook.scope.projectId : undefined;
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add sources</DialogTitle>
          <DialogDescription>
            Everything you add is read by every conversation in {notebook.name}, and stays in Files
            too.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="files">
          <TabsList className="flex-wrap">
            <TabsTrigger value="files">From Files</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="website">Website</TabsTrigger>
            <TabsTrigger value="text">Paste text</TabsTrigger>
          </TabsList>
          <TabsContent value="files" className="pt-3">
            <FromFiles notebook={notebook} projectId={projectId} actions={actions} onDone={close} />
          </TabsContent>
          <TabsContent value="upload" className="pt-3">
            <FromUpload projectId={projectId} actions={actions} />
          </TabsContent>
          <TabsContent value="website" className="pt-3">
            <FromWebsite actions={actions} onDone={close} />
          </TabsContent>
          <TabsContent value="text" className="pt-3">
            <FromText projectId={projectId} actions={actions} onDone={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
