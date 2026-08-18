import {
  ReplicateModelDetailView,
  ReplicateModelForm,
  ReplicateModelLoadError,
  ReplicateModelLoading,
} from "@ngriffin_uk/polychat-component-experiences/media";
import { useNavigate } from "react-router";

import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import { useReplicateModels, useExecuteReplicateModel } from "~/hooks/useReplicate";
import { isAuthenticationError } from "~/lib/errors";

interface ReplicateModelDetailProps {
  basePath: string;
  modelId: string;
  projectId?: string;
}

export function ReplicateModelDetail({ basePath, modelId, projectId }: ReplicateModelDetailProps) {
  const navigate = useNavigate();
  const { data: models, isLoading, error } = useReplicateModels(projectId);
  const executeMutation = useExecuteReplicateModel(projectId);

  const model = models?.find((m) => m.id === modelId);

  if (isLoading) {
    return <ReplicateModelLoading />;
  }

  if (error || !model) {
    if (isAuthenticationError(error)) {
      return (
        <SignInEmptyState
          title="Sign in to use this model"
          message="Sign in to run Replicate models for this project."
          className="min-h-[300px]"
        />
      );
    }

    return <ReplicateModelLoadError />;
  }

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      const result = await executeMutation.mutateAsync({
        modelId,
        input: data,
      });

      void navigate(`${basePath}/predictions/${result.id}`);
    } catch (error) {
      console.error("Failed to execute model:", error);
    }
  };

  return (
    <ReplicateModelDetailView
      model={model}
      errorMessage={
        executeMutation.isError
          ? executeMutation.error instanceof Error
            ? executeMutation.error.message
            : "Failed to execute model. Please try again."
          : undefined
      }
      form={
        <ReplicateModelForm
          model={model}
          onSubmit={handleSubmit}
          isSubmitting={executeMutation.isPending}
        />
      }
    />
  );
}
