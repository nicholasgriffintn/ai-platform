import { Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/BackLink";
import { EmptyState } from "~/components/EmptyState";
import { PageHeader } from "~/components/PageHeader";
import { PageShell } from "~/components/PageShell";
import { PageTitle } from "~/components/PageTitle";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button, Card } from "~/components/ui";
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

  const handleNewNote = useCallback(() => {
    navigate("/apps/notes/new");
  }, [navigate]);

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
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
      isBeta={true}
    >
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400" />
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
          title="No notes yet"
          message="Create your first note to get started."
          action={
            <Button
              onClick={handleNewNote}
              variant="primary"
              icon={<Plus size={16} />}
            >
              New Note
            </Button>
          }
          className="min-h-[400px]"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
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
