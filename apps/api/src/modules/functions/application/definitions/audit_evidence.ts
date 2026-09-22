import { evidenceAuditInputSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const audit_evidence: FunctionToolDescriptor = {
  name: "audit_evidence",
  description:
    "Verify factual claims against their cited public web sources. Extracts each source, then returns a calibrated supported, partially supported, unsupported, or contradicted verdict for every claim. Use after research or drafting when citation correctness matters; do not use it as a substitute for finding sources.",
  type: "premium",
  permissions: ["read"],
  inputSchema: evidenceAuditInputSchema,
};
