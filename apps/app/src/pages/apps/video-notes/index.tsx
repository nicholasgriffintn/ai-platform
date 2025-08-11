import { Plus } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router";

import { BackLink } from "~/components/BackLink";
import { EmptyState } from "~/components/EmptyState";
import { PageHeader } from "~/components/PageHeader";
import { PageShell } from "~/components/PageShell";
import { PageTitle } from "~/components/PageTitle";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button } from "~/components/ui";
import VideoNoteCard from "~/components/VideoNoteCard";
import { useGetVideoNotes } from "~/hooks/useVideoNotes";

export function meta() {
  return [
    { title: "Your Video Notes - Polychat" },
    { name: "description", content: "Manage your video notes" },
  ];
}

export default function VideoNotesPage() {
  const navigate = useNavigate();
  const { data: notes = [], isLoading, error } = useGetVideoNotes();

  const handleNew = useCallback(() => {
    navigate("/apps/video-notes/new");
  }, [navigate]);

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <div className="flex justify-between items-center">
          <PageHeader>
            <BackLink to="/apps" label="Back to Apps" />
            <PageTitle title="Your Video Notes" />
          </PageHeader>
          <Button onClick={handleNew} variant="primary" icon={<Plus size={16} />}>New Video Note</Button>
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
          <h3 className="font-semibold mb-2">Failed to load video notes</h3>
          <p>{error instanceof Error ? error.message : "Unknown error occurred"}</p>
          <Button type="button" variant="primary" onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
        </div>
      ) : notes?.length === 0 ? (
        <EmptyState
          title="No video notes yet"
          message="Create your first video note to get started."
          action={<Button onClick={handleNew} variant="primary" icon={<Plus size={16} />}>New Video Note</Button>}
          className="min-h-[400px]"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <VideoNoteCard key={note.id} note={note as any} />
          ))}
        </div>
      )}
    </PageShell>
  );
}