import {
  PodcastCardGrid,
  PodcastNextActionCard,
} from "@ngriffin_uk/polychat-component-experiences/content";
import {
  ButtonLink,
  CardGridLoadingSkeleton,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import type { Podcast } from "@ngriffin_uk/polychat-schemas";
import { Mic2, Plus } from "lucide-react";

import { PodcastWorkflow } from "~/components/Apps/Podcasts/PodcastWorkflow";
import { PodcastView } from "~/components/Apps/Podcasts/View";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useFetchPodcast, useFetchPodcasts, useProcessPodcast } from "~/hooks/usePodcasts";
import { isAuthenticationError } from "~/lib/errors";

export function PodcastsExperience({ basePath, projectId, subpath }: ExperienceProps) {
  const segments = subpath.split("/").filter(Boolean);
  const podcastId = segments[0] && segments[0] !== "new" ? segments[0] : undefined;
  const isNew = segments[0] === "new";
  const {
    data: podcasts,
    isLoading,
    error,
  } = useFetchPodcasts(projectId, {
    enabled: !isNew && !podcastId,
  });
  const {
    data: podcast,
    isLoading: isPodcastLoading,
    error: podcastError,
  } = useFetchPodcast(podcastId ?? "", projectId);

  if (isNew) {
    return <PodcastWorkflow basePath={basePath} projectId={projectId} />;
  }

  if (podcastId) {
    if (isPodcastLoading) {
      return <CardGridLoadingSkeleton count={1} label="Loading podcast" />;
    }

    if (isAuthenticationError(podcastError)) {
      return (
        <SignInEmptyState
          title="Sign in to view this podcast"
          message="Sign in to open this podcast."
        />
      );
    }

    if (podcastError || !podcast) {
      return (
        <EmptyState
          title="Podcast unavailable"
          message={podcastError?.message ?? "Podcast not found"}
        />
      );
    }

    return <PodcastDetail podcast={podcast} projectId={projectId} />;
  }

  if (isLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading podcasts" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view podcasts"
        message="Podcasts are kept against your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Podcasts unavailable" message={error.message} />;
  }

  if (!podcasts?.length) {
    return (
      <EmptyState
        icon={<Mic2 size={24} className="text-zinc-400" />}
        title="No podcasts yet"
        message="Upload a recording or audio URL to begin processing it."
        action={
          <ButtonLink variant="primary" icon={<Plus size={16} />} href={`${basePath}/new`}>
            New podcast
          </ButtonLink>
        }
      />
    );
  }

  return (
    <PodcastCardGrid
      podcasts={podcasts.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        createdAt: item.createdAt,
        imageUrl: item.imageUrl,
        href: `${basePath}/${item.id}`,
      }))}
      newPodcastHref={`${basePath}/new`}
    />
  );
}

function PodcastDetail({ podcast, projectId }: { podcast: Podcast; projectId?: string }) {
  const process = useProcessPodcast(projectId);
  const nextAction = !podcast.transcript
    ? "transcribe"
    : !podcast.summary
      ? "summarise"
      : !podcast.imageUrl
        ? "generate-image"
        : null;

  return (
    <div className="space-y-5">
      <PodcastNextActionCard
        action={nextAction ?? null}
        isRunning={process.isPending}
        onRun={(action) =>
          process.mutate({
            podcastId: podcast.id,
            action: action as NonNullable<typeof nextAction>,
            numberOfSpeakers: 2,
            speakers: {},
          })
        }
      />
      {isAuthenticationError(process.error) ? (
        <SignInEmptyState
          title="Sign in to continue processing"
          message="Sign in to process this podcast."
        />
      ) : (
        process.error && <p className="text-sm text-red-700">{process.error.message}</p>
      )}
      <PodcastView podcast={podcast} />
    </div>
  );
}

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
