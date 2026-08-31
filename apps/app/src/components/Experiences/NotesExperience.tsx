import { NoteCardGrid } from "@ngriffin_uk/polychat-component-experiences/content";
import {
  ButtonLink,
  CardGridLoadingSkeleton,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { NoteMetadata } from "@ngriffin_uk/polychat-schemas";
import { NotebookPen, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { NoteEditor } from "~/components/Apps/Notes/NoteEditor";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import {
  useCreateNote,
  useDeleteNote,
  useFetchNote,
  useFetchNotes,
  useUpdateNote,
} from "~/hooks/useNotes";
import { isAuthenticationError } from "~/lib/errors";

export function NotesExperience({ basePath, projectId, subpath }: ExperienceProps) {
  const navigate = useNavigate();
  const segments = subpath.split("/").filter(Boolean);
  const noteId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
  const isNew = segments[0] === "new";
  const {
    data: notes,
    isLoading,
    error,
  } = useFetchNotes(projectId, {
    enabled: !isNew && !noteId,
  });
  const {
    data: note,
    isLoading: isNoteLoading,
    error: noteError,
  } = useFetchNote(noteId, projectId);
  const createNote = useCreateNote(projectId);
  const updateNote = useUpdateNote(noteId ?? "", projectId);
  const deleteNote = useDeleteNote(projectId);
  const [isFullBleed, setIsFullBleed] = useState(false);
  const [themeMode, setThemeMode] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState("Sans");
  const [fontSize, setFontSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(null);
  const isLocallyCreatedNote = Boolean(noteId) && noteId === createdNoteId;
  const activeThemeMode = themeMode ?? note?.metadata?.themeMode ?? "sepia";
  const filteredNotes = useMemo(() => {
    const availableNotes = notes ?? [];
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return availableNotes;
    }

    return availableNotes.filter(
      (item) =>
        item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query),
    );
  }, [notes, searchQuery]);

  const saveNote = useCallback(
    async (
      title: string,
      content: string,
      additionalMetadata?: NoteMetadata,
      options?: { refreshMetadata?: boolean },
    ) => {
      const metadata = { themeMode: activeThemeMode, fontFamily, fontSize, ...additionalMetadata };

      if (noteId) {
        await updateNote.mutateAsync({ title, content, metadata, options });

        return noteId;
      }

      const created = await createNote.mutateAsync({ title, content, metadata });

      setCreatedNoteId(created.id);
      void navigate(`${basePath}/${created.id}`, { replace: true });

      return created.id;
    },
    [activeThemeMode, basePath, createNote, fontFamily, fontSize, navigate, noteId, updateNote],
  );

  if (isNew || noteId) {
    if (noteId && isNoteLoading && !isLocallyCreatedNote) {
      return <CardGridLoadingSkeleton count={1} label="Loading note" />;
    }

    if (noteId && isAuthenticationError(noteError)) {
      return (
        <SignInEmptyState title="Sign in to view this note" message="Sign in to open this note." />
      );
    }

    if (noteId && !isNoteLoading && (noteError || !note)) {
      return (
        <EmptyState title="Note unavailable" message={noteError?.message ?? "Note not found"} />
      );
    }

    return (
      <div
        className={cn(
          "flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden",
          activeThemeMode === "sepia" ? "bg-[#f8f2e3] text-[#333]" : "bg-white dark:bg-zinc-900",
          isFullBleed && "fixed inset-0 z-50 h-screen w-screen",
        )}
      >
        <NoteEditor
          key={isLocallyCreatedNote ? "new-note" : (note?.id ?? "new-note")}
          noteId={note?.id}
          projectId={projectId}
          initialText={note ? `${note.title}\n${note.content}` : ""}
          initialMetadata={note?.metadata}
          onSave={saveNote}
          onDelete={
            noteId
              ? async () => {
                  await deleteNote.mutateAsync(noteId);
                  void navigate(basePath);
                }
              : undefined
          }
          isFullBleed={isFullBleed}
          onToggleFullBleed={() => setIsFullBleed((current) => !current)}
          initialThemeMode={activeThemeMode}
          onThemeChange={setThemeMode}
          initialFontFamily={note?.metadata?.fontFamily ?? fontFamily}
          onFontFamilyChange={setFontFamily}
          initialFontSize={note?.metadata?.fontSize ?? fontSize}
          onFontSizeChange={setFontSize}
        />
      </div>
    );
  }

  if (isLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading notes" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view notes"
        message="Notes are kept against your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Notes unavailable" message={error.message} />;
  }

  if (!notes?.length) {
    return (
      <EmptyState
        icon={<NotebookPen size={24} className="text-zinc-400" />}
        title="No notes yet"
        message="Create a note for decisions, research, and working context."
        action={
          <ButtonLink variant="primary" icon={<Plus size={16} />} href={`${basePath}/new`}>
            New note
          </ButtonLink>
        }
      />
    );
  }

  return (
    <NoteCardGrid
      notes={filteredNotes.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        updatedAt: item.updatedAt,
        href: `${basePath}/${item.id}`,
      }))}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      newNoteHref={`${basePath}/new`}
    />
  );
}

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
