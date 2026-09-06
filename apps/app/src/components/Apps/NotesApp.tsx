import { NoteCardGrid } from "@ngriffin_uk/polychat-component-experiences/content";
import {
  ButtonLink,
  CardGridLoadingSkeleton,
  cn,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import type { NoteMetadata } from "@ngriffin_uk/polychat-schemas";
import { NotebookPen, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useOwnAppChrome } from "~/components/Apps/AppChrome";
import { createNoteSaver } from "~/components/Apps/Notes/note-saver";
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

export function NotesApp({ basePath, projectId, subpath }: ExperienceProps) {
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
  const updateNote = useUpdateNote(projectId);
  const deleteNote = useDeleteNote(projectId);
  const [isFullBleed, setIsFullBleed] = useState(false);
  const [themeMode, setThemeMode] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState("Sans");
  const [fontSize, setFontSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(null);
  const [saver] = useState(() =>
    createNoteSaver({
      create: (input) => createNote.mutateAsync(input),
      update: (input) => updateNote.mutateAsync(input),
      onCreated: (id) => {
        setCreatedNoteId(id);
        void navigate(`${basePath}/${id}`, { replace: true });
      },
    }),
  );

  useEffect(() => {
    if (isNew) {
      saver.reset();
    }
  }, [isNew, saver]);

  const isLocallyCreatedNote = Boolean(noteId) && noteId === createdNoteId;
  const activeThemeMode = themeMode ?? note?.metadata?.themeMode ?? "sepia";
  const chrome = useOwnAppChrome(isNew || Boolean(noteId));
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

      return saver.save(noteId, { title, content, metadata, options });
    },
    [activeThemeMode, fontFamily, fontSize, noteId, saver],
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
          "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
          activeThemeMode === "sepia" ? "bg-[#f8f2e3] text-[#333]" : "bg-surface text-foreground",
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
          backHref={chrome?.backHref}
          backLabel={chrome?.backLabel}
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
        icon={<NotebookPen size={24} className="text-muted-foreground" />}
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
