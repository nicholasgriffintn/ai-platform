import { NotebookPen, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { NoteMetadata } from "@assistant/schemas";

import { NoteEditor } from "~/components/Apps/Notes/NoteEditor";
import { EmptyState } from "~/components/Core/EmptyState";
import { Button, Card, SearchInput } from "~/components/ui";
import {
	useCreateNote,
	useDeleteNote,
	useFetchNote,
	useFetchNotes,
	useUpdateNote,
} from "~/hooks/useNotes";
import { WorkCardGridSkeleton } from "../WorkLoadingSkeletons";
import { cn } from "~/lib/utils";

export function NotesExperience({ basePath, projectId, subpath }: ExperienceProps) {
	const navigate = useNavigate();
	const segments = subpath.split("/").filter(Boolean);
	const noteId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
	const isNew = segments[0] === "new";
	const { data: notes, isLoading, error } = useFetchNotes(projectId);
	const {
		data: note,
		isLoading: isNoteLoading,
		error: noteError,
	} = useFetchNote(noteId, projectId);
	const createNote = useCreateNote(projectId);
	const updateNote = useUpdateNote(noteId ?? "", projectId);
	const deleteNote = useDeleteNote(projectId);
	const [isFullBleed, setIsFullBleed] = useState(false);
	const [themeMode, setThemeMode] = useState("sepia");
	const [fontFamily, setFontFamily] = useState("Sans");
	const [fontSize, setFontSize] = useState(25);
	const [searchQuery, setSearchQuery] = useState("");
	const filteredNotes = useMemo(() => {
		const availableNotes = notes ?? [];
		const query = searchQuery.trim().toLowerCase();
		if (!query) return availableNotes;
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
			const metadata = { themeMode, fontFamily, fontSize, ...additionalMetadata };
			if (noteId) {
				await updateNote.mutateAsync({ title, content, metadata, options });
				return noteId;
			}
			const created = await createNote.mutateAsync({ title, content, metadata });
			navigate(`${basePath}/${created.id}`, { replace: true });
			return created.id;
		},
		[basePath, createNote, fontFamily, fontSize, navigate, noteId, themeMode, updateNote],
	);

	if (isNew || noteId) {
		if (noteId && isNoteLoading) {
			return <WorkCardGridSkeleton count={1} label="Loading note" />;
		}
		if (noteId && (noteError || !note)) {
			return (
				<EmptyState title="Note unavailable" message={noteError?.message ?? "Note not found"} />
			);
		}

		return (
			<div
				className={cn(
					"flex min-h-[calc(100vh-9rem)] flex-col overflow-hidden",
					themeMode === "sepia" ? "bg-[#f8f2e3] text-[#333]" : "bg-white dark:bg-zinc-900",
					isFullBleed && "fixed inset-0 z-50 h-screen w-screen",
				)}
			>
				<NoteEditor
					key={note?.id ?? "new-note"}
					noteId={note?.id}
					projectId={projectId}
					initialText={note ? `${note.title}\n${note.content}` : ""}
					initialMetadata={note?.metadata}
					onSave={saveNote}
					onDelete={
						noteId
							? async () => {
									await deleteNote.mutateAsync(noteId);
									navigate(basePath);
								}
							: undefined
					}
					isFullBleed={isFullBleed}
					onToggleFullBleed={() => setIsFullBleed((current) => !current)}
					initialThemeMode={note?.metadata?.themeMode ?? themeMode}
					onThemeChange={setThemeMode}
					initialFontFamily={note?.metadata?.fontFamily ?? fontFamily}
					onFontFamilyChange={setFontFamily}
					initialFontSize={note?.metadata?.fontSize ?? fontSize}
					onFontSizeChange={setFontSize}
				/>
			</div>
		);
	}

	if (isLoading) return <WorkCardGridSkeleton count={4} label="Loading notes" />;
	if (error) return <EmptyState title="Notes unavailable" message={error.message} />;
	if (!notes?.length) {
		return (
			<EmptyState
				icon={<NotebookPen size={24} className="text-zinc-400" />}
				title="No project notes"
				message="Create a note for decisions, research, and working context."
				action={
					<Link to={`${basePath}/new`}>
						<Button variant="primary" icon={<Plus size={16} />}>
							New note
						</Button>
					</Link>
				}
			/>
		);
	}

	return (
		<div>
			<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
				<SearchInput
					value={searchQuery}
					onChange={setSearchQuery}
					placeholder="Search notes..."
					className="max-w-md"
				/>
				<Link to={`${basePath}/new`}>
					<Button variant="primary" icon={<Plus size={16} />}>
						New note
					</Button>
				</Link>
			</div>
			{filteredNotes.length === 0 ? (
				<EmptyState
					title="No notes found"
					message={`No notes matching "${searchQuery}"`}
					action={
						<Button variant="secondary" onClick={() => setSearchQuery("")}>
							Clear search
						</Button>
					}
				/>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{filteredNotes.map((item) => (
						<Link key={item.id} to={`${basePath}/${item.id}`} className="no-underline">
							<Card className="h-full gap-2 p-5 shadow-none hover:border-zinc-400 dark:hover:border-zinc-600">
								<h2 className="font-semibold text-zinc-950 dark:text-white">
									{item.title || "Untitled note"}
								</h2>
								<p className="line-clamp-3 text-sm leading-6 text-zinc-500">
									{item.content || "Empty note"}
								</p>
								<p className="mt-auto pt-3 text-xs text-zinc-400">
									Updated {new Date(item.updatedAt).toLocaleDateString()}
								</p>
							</Card>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

interface ExperienceProps {
	basePath: string;
	projectId: string;
	subpath: string;
}
