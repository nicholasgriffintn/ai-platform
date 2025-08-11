import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { NoteEditor } from "~/components/NoteEditor";
import { PageShell } from "~/components/PageShell";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { useDeleteNote, useFetchNote, useUpdateNote } from "~/hooks/useNotes";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Edit Note - Polychat" },
    { name: "description", content: "Edit an existing note." },
  ];
}

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: note, isLoading, error } = useFetchNote(id);
  const updateMutation = useUpdateNote(id!);
  const deleteMutation = useDeleteNote();
  const [isFullBleed, setIsFullBleed] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<string>("sepia");
  const [fontFamily, setFontFamily] = useState<string>("Sans");
  const [fontSize, setFontSize] = useState<number>(25);

  const handleSave = useCallback(
    async (
      title: string,
      content: string,
      additionalMetadata?: Record<string, any>,
    ) => {
      const metadata = {
        themeMode,
        fontFamily,
        fontSize,
        ...additionalMetadata,
      };
      const note = await updateMutation.mutateAsync({
        title,
        content,
        metadata,
      });
      return note.id;
    },
    [updateMutation, themeMode, fontFamily, fontSize],
  );

  const handleDelete = useCallback(async () => {
    await deleteMutation.mutateAsync(id!);
    navigate("/apps/notes", { replace: true });
  }, [deleteMutation, navigate, id]);

  if (isLoading) {
    return (
      <PageShell
        sidebarContent={<StandardSidebarContent />}
        className="max-w-4xl mx-auto"
      >
        <div className="flex justify-center items-center h-64">Loading...</div>
      </PageShell>
    );
  }
  if (error || !note) {
    return (
      <PageShell
        sidebarContent={<StandardSidebarContent />}
        className="max-w-4xl mx-auto"
      >
        <div className="flex justify-center items-center h-64">
          Note not found
        </div>
      </PageShell>
    );
  }

  const initialText = `${note.title}\n${note.content}`;

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      fullBleed={isFullBleed}
      bgClassName={
        themeMode === "sepia"
          ? "bg-[#f8f2e3] text-[#333]"
          : "bg-white dark:bg-zinc-900"
      }
      className={cn(
        isFullBleed
          ? "flex flex-col w-full h-full"
          : "max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]",
      )}
      headerContent={<h1 className="sr-only">Edit Note</h1>}
      isBeta={true}
    >
      <NoteEditor
        noteId={id!}
        initialText={initialText}
        initialMetadata={note.metadata}
        initialAttachments={note.attachments}
        onSave={async (title, content, metadata, attachments) => {
          const savedId = await handleSave(title, content, metadata);
          // Update note with attachments after save
          await updateMutation.mutateAsync({ title, content, metadata, attachments });
          return savedId;
        }}
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
