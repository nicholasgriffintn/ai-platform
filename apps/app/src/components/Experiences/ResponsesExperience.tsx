import { Card, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  OutputCardGrid,
  OutputDetailHeader,
  OutputRevisionReview,
  ShareLinkList,
} from "@ngriffin_uk/polychat-component-workspaces";
import { Puzzle } from "lucide-react";
import { useRef, useState } from "react";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { SignInEmptyState } from "~/components/Core/SignInEmptyState";
import {
  useCreateOutputShare,
  useOutput,
  useOutputHistory,
  useOutputs,
  useOutputShares,
  useRevokeOutputShare,
  useRestoreOutputRevision,
} from "~/hooks/useOutputs";
import { useRunnableTool } from "~/hooks/useRunnableTools";
import { isAuthenticationError } from "~/lib/errors";

export function ResponsesExperience({ basePath, projectId, subpath }: ExperienceProps) {
  const [copiedOutputId, setCopiedOutputId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<{ outputId: string; message: string } | null>(null);
  const mintedShareTokens = useRef(new Map<string, string>());
  const createShare = useCreateOutputShare();
  const revokeShare = useRevokeOutputShare();
  const restoreRevision = useRestoreOutputRevision();
  const outputId = subpath.split("/").find(Boolean);
  const { data: shares } = useOutputShares(outputId ?? null);
  const {
    data: outputs,
    isLoading,
    error,
  } = useOutputs(projectId, undefined, {
    enabled: !outputId,
  });
  const {
    data: output,
    isLoading: isOutputLoading,
    error: outputError,
  } = useOutput(outputId ?? null);
  const { data: producingTool } = useRunnableTool(output?.capabilityId ?? null);
  const { data: outputHistory, error: outputHistoryError } = useOutputHistory(outputId ?? null);

  if (outputId) {
    if (isOutputLoading) {
      return <CardGridLoadingSkeleton count={1} label="Loading output" />;
    }

    if (isAuthenticationError(outputError)) {
      return (
        <SignInEmptyState
          title="Sign in to view this output"
          message="Sign in to open this output."
        />
      );
    }

    if (outputError || !output) {
      return (
        <EmptyState
          title="Output unavailable"
          message={outputError?.message ?? "Output not found"}
        />
      );
    }

    return (
      <Card className="gap-5 p-6 shadow-none">
        <OutputDetailHeader
          capabilityId={output.capabilityId}
          title={output.title}
          provenance={output.provenance}
          isSharing={createShare.isPending}
          hasCopiedLink={copiedOutputId === output.id}
          errorMessage={shareError?.outputId === output.id ? shareError.message : undefined}
          onShare={async () => {
            setShareError(null);
            try {
              let token = mintedShareTokens.current.get(output.id);

              if (!token) {
                ({ token } = await createShare.mutateAsync({ outputId: output.id }));
                mintedShareTokens.current.set(output.id, token);
              }

              await navigator.clipboard.writeText(`${window.location.origin}/o/${token}`);
              setCopiedOutputId(output.id);
            } catch (shareFailure) {
              setCopiedOutputId(null);
              setShareError({
                outputId: output.id,
                message:
                  shareFailure instanceof Error
                    ? shareFailure.message
                    : "Could not copy the share link",
              });
            }
          }}
        />
        <ResponseRenderer app={producingTool ?? undefined} result={output.content} />
        {outputHistory ? (
          <OutputRevisionReview
            history={outputHistory}
            isRestoring={restoreRevision.isPending}
            errorMessage={
              restoreRevision.error?.message ??
              (outputHistoryError ? "Revision history is unavailable." : undefined)
            }
            onRestore={async (revision, expectedRevision) => {
              await restoreRevision.mutateAsync({
                outputId: output.id,
                revision,
                expectedRevision,
              });
            }}
          />
        ) : outputHistoryError ? (
          <p role="alert" className="text-sm text-failure">
            Revision history is unavailable.
          </p>
        ) : null}
        <ShareLinkList
          shares={shares ?? []}
          revokingShareId={revokeShare.isPending ? (revokeShare.variables?.shareId ?? null) : null}
          onRevoke={(shareId) => {
            mintedShareTokens.current.delete(output.id);
            if (copiedOutputId === output.id) {
              setCopiedOutputId(null);
            }

            revokeShare.mutate({ outputId: output.id, shareId });
          }}
        />
      </Card>
    );
  }

  if (isLoading) {
    return <CardGridLoadingSkeleton count={4} label="Loading outputs" />;
  }

  if (isAuthenticationError(error)) {
    return (
      <SignInEmptyState
        title="Sign in to view saved outputs"
        message="Saved outputs are kept against your account."
      />
    );
  }

  if (error) {
    return <EmptyState title="Outputs unavailable" message={error.message} />;
  }

  if (!outputs?.length) {
    return (
      <EmptyState
        icon={<Puzzle size={24} className="text-muted-foreground" />}
        title="Nothing saved yet"
        message="Run an experience or tool and its result lands here."
      />
    );
  }

  return (
    <OutputCardGrid
      outputs={outputs.map((item) => ({
        id: item.id,
        title: item.title,
        capabilityId: item.capabilityId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        href: `${basePath}/${item.id}`,
      }))}
    />
  );
}

interface ExperienceProps {
  basePath: string;
  projectId?: string;
  subpath: string;
}
