import { ReplicatePredictionView } from "@ngriffin_uk/polychat-component-experiences/media";
import { isAuthenticationError } from "@ngriffin_uk/polychat-library-client";
import { useReplicatePrediction, useUIStore } from "@ngriffin_uk/polychat-library-react";

export function ReplicatePredictionDetail({ predictionId }: { predictionId: string }) {
  const { data: prediction, isLoading, error } = useReplicatePrediction(predictionId);
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
