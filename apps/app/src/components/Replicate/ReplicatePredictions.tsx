import {
  ReplicateLoadError,
  ReplicateLoading,
  ReplicatePredictionList,
} from "@ngriffin_uk/polychat-component-experiences/media";
import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { Link } from "react-router";

import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useReplicatePredictions } from "~/hooks/useReplicate";
import { isAuthenticationError } from "~/lib/errors";

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
          <Link
            to={basePath}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Explore Models
          </Link>
        }
      />
    );
  }

  return <ReplicatePredictionList predictions={predictions} basePath={basePath} />;
}
