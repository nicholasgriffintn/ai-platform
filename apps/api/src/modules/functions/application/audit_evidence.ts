import { auditEvidence } from "~/modules/evidence/application/audit";
import type { ApiToolDefinition } from "~/types/functions";

import { audit_evidence as descriptor } from "./definitions/audit_evidence";

export const audit_evidence: ApiToolDefinition = {
  ...descriptor,
  execute: async (args, context) => {
    const result = await auditEvidence({
      request: context.request,
      completionId: context.completionId,
      claims: args.claims,
    });
    const lines = result.findings.flatMap((finding) => [
      `${finding.id}: ${finding.verdict} (confidence ${finding.confidence.toFixed(2)})`,
      `Claim: ${finding.claim}`,
      `Sources: ${finding.sources.join(", ")}`,
    ]);

    if (result.failedSources.length > 0) {
      lines.push(
        "Failed sources:",
        ...result.failedSources.map(({ url, error }) => `${url}: ${error}`),
      );
    }

    return {
      status: "success",
      name: descriptor.name,
      content: lines.join("\n"),
      data: {
        renderer: "evidence_audit",
        ...result,
      },
    };
  },
};
