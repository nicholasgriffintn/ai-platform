import { FormDialog, FormInput, FormTextarea } from "@ngriffin_uk/polychat-component-ui";
import type { NotebookActions } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { toast } from "sonner";

export function AddNoteDialog({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: NotebookActions;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a note"
      submitText="Save note"
      isLoading={actions.addNote.isPending}
      submitDisabled={!content.trim()}
      onSubmit={async () => {
        try {
          await actions.addNote.mutateAsync({ title: title.trim() || "Note", content });
          setTitle("");
          setContent("");
          onOpenChange(false);
        } catch (error) {
          toast.error(getErrorMessage(error, "That note did not save"));
        }
      }}
    >
      <div className="flex flex-col gap-4">
        <FormInput
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
        />
        <FormTextarea
          label="Note"
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </div>
    </FormDialog>
  );
}
