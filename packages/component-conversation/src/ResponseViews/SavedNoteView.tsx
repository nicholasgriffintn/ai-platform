import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { sourceSummarySchema } from "@ngriffin_uk/polychat-schemas";
import { StickyNote } from "lucide-react";

export function SavedNoteView({ data }: { data: unknown }) {
  const setOpenFile = useUIStore((state) => state.setOpenFile);
  const parsed = sourceSummarySchema
    .pick({ id: true, title: true, projectId: true })
    .safeParse(data);

  if (!parsed.success) {
    return null;
  }

  const note = parsed.data;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
      <StickyNote size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-foreground">{note.title}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setOpenFile({
            origin: "source",
            id: note.id,
            ...(note.projectId ? { projectId: note.projectId } : {}),
          })
        }
      >
        Open note
      </Button>
    </div>
  );
}
