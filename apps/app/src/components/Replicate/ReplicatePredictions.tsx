import {
  ReplicateLoadError,
  ReplicateLoading,
  ReplicatePredictionList,
} from "@ngriffin_uk/polychat-component-experiences/media";
import { SignInEmptyState } from "@ngriffin_uk/polychat-component-shell";
import { ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  useReplicatePredictions,
  isAuthenticationError,
} from "@ngriffin_uk/polychat-library-react";

export function ReplicatePredictions({
  basePath,
  projectId,
}: {
  basePath: string;
  projectId?: string;
}) {
  const { data: predictions, isLoading, error } = useReplicatePredictions(projectId);

  if (isLoading) {
    return <ReplicateLoading />;
  }

  if (error) {
    if (isAuthenticationError(error)) {
      return (
        <SignInEmptyState
          title="Sign in to view predictions"
          message="Sign in to access your Replicate predictions."
          className="min-h-[300px]"
        />
      );
    }

    return <ReplicateLoadError title="Failed to load predictions" />;
  }

  if (!predictions || predictions.length === 0) {
    return (
      <EmptyState
        title="No predictions yet"
        message="You haven't created any predictions yet. Explore models to get started."
        action={
          <ButtonLink variant="primary" href={basePath}>
            Explore Models
          </ButtonLink>
        }
      />
    );
  }

  return <ReplicatePredictionList predictions={predictions} basePath={basePath} />;
}
