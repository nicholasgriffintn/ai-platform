import { ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { FileQuestion } from "lucide-react";

export function FileNoPreview({
  name,
  detail,
  downloadUrl,
}: {
  name: string;
  detail?: string;
  downloadUrl?: string;
}) {
  return (
    <EmptyState
      variant="inset"
      icon={<FileQuestion size={24} className="text-muted-foreground" />}
      title={name}
      message={detail ? `No preview for this file (${detail})` : "No preview for this file"}
      action={
        downloadUrl ? (
          <ButtonLink href={downloadUrl} variant="outline" size="sm">
            Download
          </ButtonLink>
        ) : undefined
      }
      className="h-full"
    />
  );
}
