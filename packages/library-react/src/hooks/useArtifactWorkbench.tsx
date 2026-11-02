import { useContext } from "react";

import {
  ArtifactWorkbenchContext,
  type ArtifactWorkbenchValue,
} from "../state/artifact-workbench-context.js";

export type { ArtifactWorkbenchValue } from "../state/artifact-workbench-context.js";

export function useArtifactWorkbench(): ArtifactWorkbenchValue {
  const value = useContext(ArtifactWorkbenchContext);

  if (!value) {
    throw new Error("useArtifactWorkbench must be used inside an ArtifactWorkbenchProvider");
  }

  return value;
}
