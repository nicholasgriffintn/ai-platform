import {
  RecordingCardGrid,
  RecordingNextActionCard,
} from "@ngriffin_uk/polychat-component-experiences/content";
import {
  ButtonLink,
  CardGridLoadingSkeleton,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useFetchRecording,
  useFetchRecordings,
  useProcessRecording,
  isAuthenticationError,
} from "@ngriffin_uk/polychat-library-react";
import type { Recording } from "@ngriffin_uk/polychat-schemas";
import { Mic2, Plus } from "lucide-react";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { RecordingWorkflow } from "./Recordings/RecordingWorkflow.js";
import { RecordingView } from "./Recordings/View.js";

export function RecordingsApp({ basePath, projectId, subpath }: ExperienceProps) {
  const firstSegment = subpath.split("/").find(Boolean);
  const recordingId = firstSegment && firstSegment !== "new" ? firstSegment : undefined;
  const isNew = firstSegment === "new";
  const {
    data: recordings,
    isLoading,
    error,
  } = useFetchRecordings(projectId, {
    enabled: !isNew && !recordingId,
  });
  const {
    data: recording,
    isLoading: isRecordingLoading,
    error: recordingError,
  } = useFetchRecording(recordingId ?? "", projectId);

  if (isNew) {
    return <RecordingWorkflow basePath={basePath} projectId={projectId} />;
  }

  if (recordingId) {
    if (isRecordingLoading) {
      return <CardGridLoadingSkeleton count={1} label="Loading recording" />;
    }

    if (isAuthenticationError(recordingError)) {
      return (
        <SignInEmptyState
          title="Sign in to view this recording"
          message="Sign in to open this recording."
        />
      );
    }

    if (recordingError || !recording) {
      return (
        <EmptyState
          title="Recording unavailable"
          message={recordingError?.message ?? "Recording not found"}
        />
      );
    }

    return <RecordingDetail recording={recording} projectId={projectId} />;
  }

  if (isLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading recordings" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view recordings"
        message="Recordings are kept against your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Recordings unavailable" message={error.message} />;
  }

  if (!recordings?.length) {
    return (
      <EmptyState
        icon={<Mic2 size={24} className="text-muted-foreground" />}
        title="No recordings yet"
        message="Upload a recording or audio URL to begin processing it."
        action={
          <ButtonLink variant="primary" icon={<Plus size={16} />} href={`${basePath}/new`}>
            New recording
          </ButtonLink>
        }
      />
    );
  }

  return (
    <RecordingCardGrid
      recordings={recordings.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        createdAt: item.createdAt,
        imageUrl: item.imageUrl,
        href: `${basePath}/${item.id}`,
      }))}
      newRecordingHref={`${basePath}/new`}
    />
  );
}

function RecordingDetail({ recording, projectId }: { recording: Recording; projectId?: string }) {
  const process = useProcessRecording(projectId);
  const nextAction = !recording.transcript
    ? "transcribe"
    : !recording.summary
      ? "summarise"
      : !recording.imageUrl
        ? "generate-image"
        : null;

  return (
    <div className="space-y-5">
      <RecordingNextActionCard
        action={nextAction ?? null}
        isRunning={process.isPending}
        onRun={(action) =>
          process.mutate({
            recordingId: recording.id,
            action: action as NonNullable<typeof nextAction>,
            numberOfSpeakers: 2,
            speakers: {},
          })
        }
      />
      {isAuthenticationError(process.error) ? (
        <SignInEmptyState
          title="Sign in to continue processing"
          message="Sign in to process this recording."
        />
      ) : (
        process.error && <p className="text-sm text-failure">{process.error.message}</p>
      )}
      <RecordingView recording={recording} />
    </div>
  );
}

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
