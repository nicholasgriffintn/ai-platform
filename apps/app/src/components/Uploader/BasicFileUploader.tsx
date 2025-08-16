// Source: https://originui.com/file-upload

import { Button } from "~/components/ui/Button";
import { useFileUpload } from "~/hooks/use-file-upload";

export function BasicFileUploader({
  id,
  accept = "*/*",
}: {
  id: string;
  accept?: string;
}) {
  const [{ files }, { removeFile, openFileDialog, getInputProps }] =
    useFileUpload({
      accept,
    });

  const fileName = files[0]?.file.name || null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center gap-2 align-top">
        <div className="relative inline-block">
          <Button onClick={openFileDialog} aria-haspopup="dialog">
            {fileName ? "Change file" : "Upload file"}
          </Button>
          <input
            {...getInputProps()}
            id={id}
            className="sr-only"
            aria-label="Upload file"
          />
        </div>
      </div>
      {fileName && (
        <div className="inline-flex gap-2 text-xs">
          <p className="text-muted-foreground truncate" aria-live="polite">
            {fileName}
          </p>{" "}
          <button
            type="button"
            onClick={() => removeFile(files[0]?.id)}
            className="text-destructive font-medium hover:underline"
            aria-label={`Remove ${fileName}`}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
