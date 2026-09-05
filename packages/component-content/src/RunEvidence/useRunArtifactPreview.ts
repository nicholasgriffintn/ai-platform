import { useRef, useState } from "react";

import type { RunEvidenceContent } from "./RunChangesView";

export interface RunArtifactItem {
  outputId: string;
  name: string;
  kind: string;
  contentType: string;
  sizeBytes: number;
}

interface ArtifactPreviewState {
  artifact?: RunArtifactItem;
  content?: RunEvidenceContent;
  status: "idle" | "loading" | "ready" | "failed";
  errorMessage?: string;
}

export function useRunArtifactPreview(
  loadArtifact: (outputId: string) => Promise<RunEvidenceContent>,
) {
  const requestId = useRef(0);
  const [state, setState] = useState<ArtifactPreviewState>({ status: "idle" });

  const selectArtifact = async (artifact: RunArtifactItem) => {
    const currentRequest = requestId.current + 1;

    requestId.current = currentRequest;
    setState({ artifact, status: "loading" });

    try {
      const content = await loadArtifact(artifact.outputId);

      if (requestId.current === currentRequest) {
        setState({ artifact, content, status: "ready" });
      }
    } catch (error) {
      if (requestId.current === currentRequest) {
        setState({
          artifact,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Artifact could not be loaded",
        });
      }
    }
  };

  return { ...state, selectArtifact };
}
