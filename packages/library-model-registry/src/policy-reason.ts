import type { PolicyCondition } from "@ngriffin_uk/polychat-schemas";
import { assertUnreachable, formatParameterCount } from "@ngriffin_uk/polychat-utility-core";

import type { PolicySubject } from "./policy.js";

export function policyMatchReason(condition: PolicyCondition, subject: PolicySubject): string {
  switch (condition.type) {
    case "cedar":
      return "Cedar policy applies to this version";
    case "always":
      return "Applies to every version in scope";
    case "asset_kind":
      return `Asset is a ${subject.kind}`;
    case "licence":
      return `Licence is ${subject.attributes.licence ?? "unknown"}`;
    case "source":
      return `Source is ${subject.source}`;
    case "format":
      return `Weights ${condition.op === "only" ? "are only" : "include"} ${subject.attributes.formats.filter((format) => condition.values.includes(format)).join(", ")}`;
    case "remote_code":
      return "Loading requires trust_remote_code";
    case "gated":
      return "Repository is gated behind accepted terms";
    case "parameters_above":
      return `${formatParameterCount(subject.attributes.parameterCount ?? 0)} parameters exceeds ${formatParameterCount(condition.value)}`;
    case "evidence": {
      const found = subject.evidence.find(
        (item) => item.kind === condition.kind && condition.statuses.includes(item.status),
      );

      return `${condition.kind} evidence is ${found?.status}: ${found?.summary}`;
    }

    case "evidence_missing":
      return `No ${condition.kind} evidence recorded yet`;
    case "route_region":
      return `Route serves from ${subject.route?.region}`;
    case "route_weights_unverified":
      return "Provider does not prove which weights it serves";
    case "route_jurisdiction":
      return `Route runs in jurisdiction ${subject.route?.jurisdiction ?? "unknown"}`;
    case "route_retention":
      return `Route retention is ${subject.route?.retention}`;
    case "lawful_basis":
      return `Lawful basis is ${subject.dataset?.lawfulBasis}`;
    case "customer_data":
      return "Dataset contains customer data";
    default:
      return assertUnreachable(condition);
  }
}
