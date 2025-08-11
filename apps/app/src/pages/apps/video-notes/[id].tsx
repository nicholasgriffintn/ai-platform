import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { NoteEditor } from "~/components/NoteEditor";
import { PageShell } from "~/components/PageShell";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { useDeleteVideoNote, useGetVideoNote } from "~/hooks/useVideoNotes";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Video Note - Polychat" },
    { name: "description", content: "View and edit a video note." },
  ];
}

export default function VideoNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: note, isLoading, error } = useGetVideoNote(id);
  const deleteMutation = useDeleteVideoNote();
  const [isFullBleed, setIsFullBleed] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<string>("sepia");
  const [fontFamily, setFontFamily] = useState<string>("Sans");
  const [fontSize, setFontSize] = useState<number>(25);

  const handleSave = useCallback(async () => {
    // Edits are stored via existing notes edit route; leaving edit wiring for future enhancement
    return id!;
  }, [id]);

  const handleDelete = useCallback(async () => {
    await deleteMutation.mutateAsync(id!);
    navigate("/apps/video-notes", { replace: true });
  }, [deleteMutation, navigate, id]);

  if (isLoading) {
    return (
      <PageShell sidebarContent={<StandardSidebarContent />} className="max-w-4xl mx-auto">
        <div className="flex justify-center items-center h-64">Loading...</div>
      </PageShell>
    );
  }
  if (error || !note) {
    return (
      <PageShell sidebarContent={<StandardSidebarContent />} className="max-w-4xl mx-auto">
        <div className="flex justify-center items-center h-64">Note not found</div>
      </PageShell>
    );
  }

  const initialText = `${note.title}\n${note.content}`;

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      fullBleed={isFullBleed}
      bgClassName={themeMode === "sepia" ? "bg-[#f8f2e3] text-[#333]" : "bg-white dark:bg-zinc-900"}
      className={cn(isFullBleed ? "flex flex-col w-full h-full" : "max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]")}
      headerContent={<h1 className="sr-only">Video Note</h1>}
      isBeta={true}
    >
      <NoteEditor
        noteId={id!}
        initialText={initialText}
        initialMetadata={note.metadata}
        onSave={handleSave as any}
        onDelete={handleDelete}
        isFullBleed={isFullBleed}
        onToggleFullBleed={() => setIsFullBleed(!isFullBleed)}
        initialThemeMode={note.metadata?.themeMode}
        onThemeChange={setThemeMode}
        initialFontFamily={note.metadata?.fontFamily}
        onFontFamilyChange={setFontFamily}
        initialFontSize={note.metadata?.fontSize}
        onFontSizeChange={setFontSize}
      />
    </PageShell>
  );
}