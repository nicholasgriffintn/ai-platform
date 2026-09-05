import type { SandboxRunData } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

import { boundTextToBytes } from "~/lib/api/bounded-response";
import { getOutputArtifactContent } from "~/lib/api/outputs";

const MAX_DIFF_PREVIEW_BYTES = 1_000_000;

function diffArtifact(run: SandboxRunData | undefined) {
  return run?.manifest?.artifacts.find(
    (artifact) => artifact.kind === "diff" || artifact.name === "diff.patch",
  );
}

export function useProjectWorkbenchDiff(run: SandboxRunData | undefined) {
  const artifact = diffArtifact(run);
  const inlineDiff = run?.result?.diff?.trim();
  const boundedInlineDiff = inlineDiff
    ? boundTextToBytes(inlineDiff, MAX_DIFF_PREVIEW_BYTES)
    : undefined;
  const query = useQuery({
    queryKey: ["project-workbench-diff", run?.runId, artifact?.outputId],
    queryFn: () => getOutputArtifactContent(artifact?.outputId ?? "", MAX_DIFF_PREVIEW_BYTES),
    enabled: Boolean(artifact?.outputId && !inlineDiff),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    content: boundedInlineDiff
      ? {
          text: boundedInlineDiff.text,
          contentType: "text/x-diff; charset=utf-8",
          truncated: boundedInlineDiff.truncated,
          binary: false,
        }
      : query.data,
    isLoading: Boolean(artifact?.outputId && !inlineDiff && query.isLoading),
    error: query.error,
  };
}
