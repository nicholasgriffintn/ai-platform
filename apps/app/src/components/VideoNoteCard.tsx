import { Link } from "react-router";
import { Card } from "~/components/ui";
import { cn } from "~/lib/utils";
import type { VideoNote } from "~/types/video-note";

interface Props {
  note: VideoNote;
}

export default function VideoNoteCard({ note }: Props) {
  const createdAt = new Date(note.createdAt).toLocaleDateString();
  const status = note.processingStatus || note.metadata?.processingStatus || "complete";
  const platform = note.metadata?.platform;

  return (
    <Link
      to={`/apps/video-notes/${note.id}`}
      className="no-underline block focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl"
    >
      <Card
        className={cn(
          "p-5 h-full",
          "hover:shadow-lg transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600",
        )}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200 line-clamp-1">
            {note.title || note.metadata?.videoTitle || "Video Note"}
          </h3>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              status === "complete"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : status === "processing"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
            )}
          >
            {status}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 mt-2">
          {note.content}
        </p>
        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex gap-3">
          <span>Created: {createdAt}</span>
          {platform ? <span>Platform: {platform}</span> : null}
        </div>
      </Card>
    </Link>
  );
}