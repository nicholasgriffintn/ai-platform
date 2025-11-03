import { FileText, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/Core/BackLink";
import { EmptyState } from "~/components/Core/EmptyState";
import { Logo } from "~/components/Core/Logo";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageShell } from "~/components/Core/PageShell";
import { PageTitle } from "~/components/Core/PageTitle";
import { AppsSidebarContent } from "~/components/Sidebar/AppsSidebarContent";
import { Button, Card, SearchInput } from "~/components/ui";
import { CardSkeleton } from "~/components/ui/skeletons";
import { useFetchNotes } from "~/hooks/useNotes";
import { cn } from "~/lib/utils";

export function meta() {
	return [
		{ title: "Your Notes - Polychat" },
		{ name: "description", content: "Manage your notes" },
	];
}

export default function NotesPage() {
	const navigate = useNavigate();
	const { data: notes = [], isLoading, error } = useFetchNotes();
	const [searchQuery, setSearchQuery] = useState("");

	const handleNewNote = useCallback(() => {
		navigate("/apps/notes/new");
	}, [navigate]);

	const filteredNotes = useMemo(() => {
		if (!searchQuery.trim()) return notes;

		const query = searchQuery.toLowerCase();
		return notes.filter(
			(note) =>
				note.title.toLowerCase().includes(query) ||
				note.content.toLowerCase().includes(query),
		);
	}, [notes, searchQuery]);

	return (
		<PageShell
			sidebarContent={<AppsSidebarContent />}
			className="max-w-7xl mx-auto"
			headerContent={
				<div className="flex justify-between items-center">
					<PageHeader>
						<BackLink to="/apps" label="Back to Apps" />
						<PageTitle title="Your Notes" />
					</PageHeader>
					<Button
						onClick={handleNewNote}
						variant="primary"
						icon={<Plus size={16} />}
					>
						New Note
					</Button>
				</div>
			}
		>
			{notes.length > 0 && (
				<div className="mb-6">
					<SearchInput
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder="Search notes..."
						className="max-w-md"
					/>
				</div>
			)}

			{isLoading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<CardSkeleton count={6} showHeader={false} contentLines={3} />
				</div>
			) : error ? (
				<div className="p-4 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
					<h3 className="font-semibold mb-2">Failed to load notes</h3>
					<p>
						{error instanceof Error ? error.message : "Unknown error occurred"}
					</p>
					<Button
						type="button"
						variant="primary"
						onClick={() => window.location.reload()}
						className="mt-4"
					>
						Try Again
					</Button>
				</div>
			) : notes?.length === 0 ? (
				<EmptyState
					variant="welcome"
					icon={<Logo variant="logo_control" />}
					title="Welcome to Notes"
					message="Create your first note to get started. Perfect for quick thoughts, meeting notes, or to-do lists."
					suggestions={[
						{ label: "Quick note", onClick: handleNewNote },
						{ label: "Meeting notes", onClick: handleNewNote },
						{ label: "To-do list", onClick: handleNewNote },
					]}
					action={
						<Button
							onClick={handleNewNote}
							variant="primary"
							icon={<Plus size={16} />}
						>
							Create Your First Note
						</Button>
					}
				/>
			) : filteredNotes.length === 0 ? (
				<EmptyState
					icon={<FileText className="h-8 w-8 text-zinc-400" />}
					title="No notes found"
					message={`No notes matching "${searchQuery}"`}
					action={
						<Button onClick={() => setSearchQuery("")} variant="secondary">
							Clear Search
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{filteredNotes.map((note) => (
						<Link
							key={note.id}
							to={`/apps/notes/${note.id}`}
							className="no-underline block focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-xl"
						>
							<Card
								className={cn(
									"p-5 h-full",
									"hover:shadow-lg transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600",
								)}
							>
								<h3 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">
									{note.title}
								</h3>
								<p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
									{note.content}
								</p>
								<p className="text-xs text-zinc-500 dark:text-zinc-400">
									Created: {new Date(note.createdAt).toLocaleDateString()}
								</p>
							</Card>
						</Link>
					))}
				</div>
			)}
		</PageShell>
	);
}
