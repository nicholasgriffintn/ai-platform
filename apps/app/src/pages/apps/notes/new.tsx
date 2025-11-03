import { useCallback, useState } from "react";

import { NoteEditor } from "~/components/Apps/Notes/NoteEditor";
import { PageShell } from "~/components/Core/PageShell";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { useCreateNote, useUpdateNote } from "~/hooks/useNotes";
import { cn } from "~/lib/utils";

export function meta() {
	return [
		{ title: "New Note - Polychat" },
		{ name: "description", content: "Create a new note" },
	];
}

export default function NewNotePage() {
	const createMutation = useCreateNote();
	const [noteId, setNoteId] = useState<string | undefined>(undefined);
	const updateMutation = useUpdateNote(noteId ?? "");
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
			if (!noteId) {
				const note = await createMutation.mutateAsync({
					title,
					content,
					metadata,
				});
				setNoteId(note.id);
				if (typeof window !== "undefined") {
					window.history.replaceState({}, "", `/apps/notes/${note.id}`);
				}
				return note.id;
			}
			await updateMutation.mutateAsync({ title, content, metadata });
			return noteId;
		},
		[noteId, createMutation, updateMutation, themeMode, fontFamily, fontSize],
	);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			fullBleed={isFullBleed}
			bgClassName={
				themeMode === "sepia"
					? "bg-[#f8f2e3] text-[#333]"
					: "bg-white dark:bg-zinc-900"
			}
			className={cn(
				isFullBleed
					? "flex flex-col w-full h-full"
					: "max-w-4xl mx-auto flex flex-col h-full",
			)}
			headerContent={<h1 className="sr-only">New Note</h1>}
		>
			<NoteEditor
				noteId={noteId}
				initialText=""
				onSave={handleSave}
				isFullBleed={isFullBleed}
				onToggleFullBleed={() => setIsFullBleed(!isFullBleed)}
				initialThemeMode={themeMode}
				onThemeChange={setThemeMode}
				initialFontFamily={fontFamily}
				onFontFamilyChange={setFontFamily}
				initialFontSize={fontSize}
				onFontSizeChange={setFontSize}
			/>
		</PageShell>
	);
}
