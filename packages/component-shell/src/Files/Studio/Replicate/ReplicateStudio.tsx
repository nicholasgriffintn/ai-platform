import { ReplicateModelDetail } from "./ReplicateModelDetail.js";
import { ReplicateModels } from "./ReplicateModels.js";
import { ReplicatePredictionDetail } from "./ReplicatePredictionDetail.js";
import { ReplicatePredictions } from "./ReplicatePredictions.js";

export function ReplicateStudio({
  basePath,
  projectId,
  subpath,
}: {
  basePath: string;
  projectId?: string;
  subpath: string;
}) {
  const [first, second] = subpath.split("/").filter(Boolean);

  if (first === "predictions" && second) {
    return <ReplicatePredictionDetail predictionId={second} />;
  }

  if (first === "predictions") {
    return <ReplicatePredictions basePath={basePath} projectId={projectId} />;
  }

  if (first) {
    return <ReplicateModelDetail basePath={basePath} modelId={first} projectId={projectId} />;
  }

  return <ReplicateModels basePath={basePath} />;
}
