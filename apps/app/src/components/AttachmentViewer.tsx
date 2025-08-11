import { Download } from "lucide-react";
import type { Attachment } from "~/types/note";
import { ImageModal } from "~/components/ui/ImageModal";

interface AttachmentViewerProps {
  attachments?: Attachment[];
  view?: "grid" | "list";
}

export default function AttachmentViewer({ attachments = [], view = "grid" }: AttachmentViewerProps) {
  if (!attachments?.length) return null;

  if (view === "list") {
    return (
      <div className="divide-y border rounded">
        {attachments.map((att) => (
          <div key={att.url} className="p-3 flex items-center gap-3">
            <Preview attachment={att} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" title={att.name || att.url}>
                {att.name || att.url}
              </div>
              <div className="text-xs text-muted-foreground flex gap-2">
                <span>{att.type}</span>
                {att.size ? <span>{Math.round((att.size / 1024 / 1024) * 10) / 10} MB</span> : null}
              </div>
              {att.metadata?.summary && (
                <div className="text-xs mt-1 line-clamp-2">{att.metadata.summary}</div>
              )}
            </div>
            <a href={att.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 px-2 py-1 border rounded">
              <Download className="h-3 w-3" />
              Open
            </a>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {attachments.map((att) => (
        <div key={att.url} className="border rounded p-2">
          <Preview attachment={att} />
          <div className="mt-2 text-xs truncate" title={att.name || att.url}>
            {att.name || att.url}
          </div>
        </div>
      ))}
    </div>
  );
}

function Preview({ attachment }: { attachment: Attachment }) {
  if (attachment.type === "image") {
    return (
      <ImageModal
        src={attachment.url}
        alt={attachment.name}
        thumbnailClassName="block"
        imageClassName="h-28 w-full object-cover rounded"
      />
    );
  }
  if (attachment.type === "video") {
    return (
      <video src={attachment.url} controls className="h-28 w-full object-cover rounded" />
    );
  }
  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className="block h-28 w-full bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-xs">
      {attachment.type === "document" || attachment.type === "markdown_document" ? "Document" : attachment.type === "audio" ? "Audio" : "File"}
    </a>
  );
}