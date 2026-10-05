import {
  RecordTableForm,
  Button,
  ButtonLink,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useCreateNativeRecordTable } from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";

export function CreateRecordTable({
  projectId,
  basePath,
}: {
  projectId?: string;
  basePath: string;
}) {
  const create = useCreateNativeRecordTable();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          create.reset();
          setOpen(true);
        }}
      >
        Create table
      </Button>
      <Dialog open={open} onOpenChange={setOpen} width="min(48rem, 100%)">
        <DialogContent>
          <DialogTitle>Create a record table</DialogTitle>
          <DialogDescription>
            Keep structured records in Files and reuse them in documents and Sites.
          </DialogDescription>
          {create.data ? (
            <ButtonLink href={`${basePath}/${encodeURIComponent(create.data.output.id)}`}>
              Open {create.data.output.title}
            </ButtonLink>
          ) : open ? (
            <RecordTableForm
              isSaving={create.isPending}
              errorMessage={create.error?.message}
              onSave={async (title, definition) => {
                try {
                  await create.mutateAsync({ title, projectId, definition });

                  return true;
                } catch {
                  return false;
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
