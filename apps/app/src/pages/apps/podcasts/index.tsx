import { Plus } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate } from "react-router";

import { BackLink } from "~/components/BackLink";
import { PageHeader } from "~/components/PageHeader";
import { PageShell } from "~/components/PageShell";
import { PageTitle } from "~/components/PageTitle";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";
import { Button } from "~/components/ui";
import { useFetchPodcasts } from "~/hooks/usePodcasts";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Your Podcasts - Polychat" },
    { name: "description", content: "Manage your podcasts" },
  ];
}

export default function PodcastsPage() {
  const navigate = useNavigate();
  const { data: podcasts, isLoading, error } = useFetchPodcasts();

  const handleNewPodcast = useCallback(() => {
    navigate("/apps/podcasts/new");
  }, [navigate]);

  return (
    <PageShell
      sidebarContent={<StandardSidebarContent />}
      className="max-w-7xl mx-auto"
      headerContent={
        <div className="flex justify-between items-center">
          <PageHeader>
            <BackLink to="/apps" label="Back to Apps" />
            <PageTitle title="Your Podcasts" />
          </PageHeader>
          <Button
            onClick={handleNewPodcast}
            variant="primary"
            icon={<Plus size={16} />}
          >
            New Podcast
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
          <h3 className="font-semibold mb-2">Failed to load podcasts</h3>
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
      ) : podcasts?.length === 0 ? (
        <div className="bg-off-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center">
          <h3 className="text-xl font-semibold mb-4 text-zinc-800 dark:text-zinc-200">
            No podcasts yet
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Upload your first podcast to get started. We'll help you transcribe,
            summarise, and create a cover image.
          </p>
          <Button
            onClick={handleNewPodcast}
            variant="primary"
            icon={<Plus size={16} />}
          >
            Upload Podcast
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {podcasts?.map((podcast) => (
            <Link
              key={podcast.id}
              to={`/apps/podcasts/${podcast.id}`}
              className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 hover:shadow-lg transition-all duration-200 bg-off-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
            >
              <div className="relative aspect-video w-full rounded-lg overflow-hidden mb-4">
                {podcast.imageUrl ? (
                  <img
                    src={podcast.imageUrl}
                    alt={podcast.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      No image
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "absolute top-2 right-2 px-2 py-1 text-xs rounded-full",
                    podcast.status === "complete"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
                  )}
                >
                  {podcast.status === "complete" ? "Complete" : "Processing"}
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-1 text-zinc-800 dark:text-zinc-200">
                {podcast.title}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {new Date(podcast.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
