import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { ArtificialAnalysisIngestHandler } from "./ArtificialAnalysisIngestHandler";
import { ArtificialAnalysisScoringHandler } from "./ArtificialAnalysisScoringHandler";

export function registerModelAnalysisQueue(workflows: AppWorkflows): void {
  workflows.register("artificial_analysis_ingest", new ArtificialAnalysisIngestHandler());
  workflows.register("artificial_analysis_scoring", new ArtificialAnalysisScoringHandler());
}
