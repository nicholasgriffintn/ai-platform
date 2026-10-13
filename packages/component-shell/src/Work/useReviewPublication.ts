import {
  useProjectTaskIntegrations,
  useProjectTaskReview,
} from "@ngriffin_uk/polychat-library-react";
import type { PreparedReviewPublication, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useReviewPublication(projectId: string, task: ProjectTask) {
  const { prepare, publish, checkPublication } = useProjectTaskIntegrations(projectId);
  const reviewQuery = useProjectTaskReview(projectId, task.id);
  const review = reviewQuery.data?.review;
  const [prepared, setPrepared] = useState<PreparedReviewPublication | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const currentPrepared =
    prepared?.review.taskId === task.id && prepared.review.projectId === projectId
      ? prepared
      : null;
  const open = async () => {
    if (!review || prepare.isPending) {
      return;
    }

    setError(null);
    try {
      const result = await prepare.mutateAsync(review.id);

      setBody(result.body);
      setPrepared(result);
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to prepare this review"));
    }
  };

  const approve = async () => {
    if (!currentPrepared || publish.isPending) {
      return;
    }

    setError(null);
    try {
      await publish.mutateAsync({
        reviewId: currentPrepared.review.id,
        input: { completionId: currentPrepared.completionId, body },
      });
      setPrepared(null);
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to publish this review"));
    }
  };

  const check = async () => {
    if (!review || checkPublication.isPending) {
      return;
    }

    setError(null);
    try {
      await checkPublication.mutateAsync(review.id);
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to check publication"));
    }
  };

  return {
    review,
    prepared: currentPrepared,
    body,
    setBody,
    error: error ?? reviewQuery.error?.message,
    open,
    approve,
    check,
    close: () => setPrepared(null),
    pending: prepare.isPending || publish.isPending || checkPublication.isPending,
  };
}
