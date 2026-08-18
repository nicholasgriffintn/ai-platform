import { ReplicatePredictionView } from "@ngriffin_uk/polychat-component-experiences/media";

import { useReplicatePrediction } from "~/hooks/useReplicate";
import { isAuthenticationError } from "~/lib/errors";
import { useUIStore } from "~/state/stores/uiStore";

interface ReplicatePredictionDetailProps {
  predictionId: string;
  projectId?: string;
}

export function ReplicatePredictionDetail({
  predictionId,
  projectId,
}: ReplicatePredictionDetailProps) {
  const { data: prediction, isLoading, error } = useReplicatePrediction(predictionId, projectId);
  const setShowLoginModal = useUIStore((state) => state.setShowLoginModal);

  return (
    <ReplicatePredictionView
      prediction={prediction}
      isLoading={isLoading}
      requiresSignIn={isAuthenticationError(error)}
      hasError={!!error}
      onSignIn={() => setShowLoginModal(true)}
    />
  );
}
