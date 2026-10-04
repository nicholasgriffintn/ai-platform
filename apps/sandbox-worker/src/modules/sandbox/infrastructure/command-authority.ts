import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  hasBlockedShellChainingOperators,
  hasBlockedShellEvaluationOperators,
  type SandboxTrustLevel,
} from "@ngriffin_uk/polychat-schemas";

const FORBIDDEN_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/(?:\s|$)/i,
  /\b(sudo|shutdown|reboot|mkfs|dd)\b/i,
  /\b(curl|wget)\b[^\n]*\|/i,
  /\bgit\s+(add|branch|checkout|commit|push|switch)\b/i,
];

const READ_ONLY_MUTATING_PATTERNS: RegExp[] = [
  /\bgit\s+(add|commit|merge|rebase|cherry-pick|reset|checkout|switch|restore|clean|stash|tag|branch|push|pull)\b/i,
  /\bgit\s+(apply|am)\b/i,
  /\b(rm|mv|cp|mkdir|rmdir|touch|truncate|chmod|chown)\b/i,
  /\b(npm|pnpm|yarn|bun)\s+(install|add|remove|update)\b/i,
  /\b(pip|pip3|poetry)\s+(install|add|remove)\b/i,
  /\b(?:sed|perl)\s+-i\b/i,
  /\btee\b/i,
];

const NETWORK_COMMAND_PATTERNS: RegExp[] = [
  /\b(curl|wget|httpie)\b/i,
  /\b(npm|pnpm|yarn|bun)\s+(install|add|update|upgrade)\b/i,
  /\b(pip|pip3|poetry)\s+(install|add)\b/i,
  /\b(cargo)\s+(add|install)\b/i,
  /\b(go)\s+(get|install)\b/i,
];

const RISKY_COMMAND_PATTERNS: RegExp[] = [
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\brm\s+-rf\b/i,
  /\bmv\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bdocker\b/i,
];

const READ_ONLY_BLOCKED_OPERATOR_PATTERNS: RegExp[] = [/(^|[^<])>(>|&)?/i, /<</i, /\bexec\b/i];

const READ_ONLY_ALLOWED_COMMAND_PATTERNS: RegExp[] = [
  /^git\s+(status|diff|log|show|rev-parse|ls-files|branch(?:\s+--show-current)?)(?:\s|$)/i,
  /^(ls|pwd|find|cat|head|tail|wc|sort|uniq|cut|grep|rg|awk)\b/i,
  /^sed\s+-n\b/i,
  /^(npm|pnpm|yarn|bun)\s+(test|lint|check|verify|build|run\s+(test|lint|typecheck|type-check|check|verify|build))\b/i,
  /^(pytest|tox|go\s+test|cargo\s+(test|check|clippy|fmt\s+--check)|jest|vitest|npx\s+vitest|tsc(?:\s|$)|eslint(?:\s|$)|ruff(?:\s|$)|mypy(?:\s|$)|uv\s+run\s+pytest)\b/i,
];

export interface SandboxCommandAuthority {
  readOnly?: boolean;
  trustLevel?: SandboxTrustLevel;
  allowNetwork?: boolean;
  allowRisky?: boolean;
}

const DENIAL_REASONS = [
  ["sandbox.command.length:0", "Command is too long"],
  ["sandbox.command.multiline:0", "Command contains unexpected newlines"],
  ["sandbox.command.chains:0", "Command contains blocked shell operators"],
  ["sandbox.command.evaluation:0", "Command contains blocked shell evaluation"],
  ["sandbox.command.readonly:0", "Command is blocked in read-only mode"],
  ["sandbox.command.unknown:0", "Command is not allowed in read-only mode"],
  ["sandbox.command.forbidden:0", "Command is blocked by sandbox policy"],
  ["sandbox.command.network:0", "Network/dependency command is blocked by the trust policy"],
  ["sandbox.command.risky:0", "Risky command is blocked in strict mode"],
];

function commandRiskFacts(command: string) {
  return {
    network: NETWORK_COMMAND_PATTERNS.some((pattern) => pattern.test(command)),
    risky: RISKY_COMMAND_PATTERNS.some((pattern) => pattern.test(command)),
  };
}

export function assertSafeCommand(command: string, options: SandboxCommandAuthority = {}): void {
  const decision = authorise("sandbox.command", {
    ...commandRiskFacts(command),
    length: command.length,
    multiline: command.includes("\n") || command.includes("\r"),
    chains: hasBlockedShellChainingOperators(command),
    evaluation: hasBlockedShellEvaluationOperators(command),
    readOnly: options.readOnly === true,
    readOnlyMutation: READ_ONLY_MUTATING_PATTERNS.some((pattern) => pattern.test(command)),
    readOnlyOperator: READ_ONLY_BLOCKED_OPERATOR_PATTERNS.some((pattern) => pattern.test(command)),
    readOnlyAllowed: READ_ONLY_ALLOWED_COMMAND_PATTERNS.some((pattern) => pattern.test(command)),
    forbidden: FORBIDDEN_COMMAND_PATTERNS.some((pattern) => pattern.test(command)),
    trustLevel: options.trustLevel ?? "balanced",
    allowNetwork: options.allowNetwork === true,
    allowRisky: options.allowRisky === true,
  });

  if (!decision.allowed) {
    const reason =
      DENIAL_REASONS.find(([id]) => decision.policyIds.includes(id))?.[1] ??
      "Command is blocked by sandbox policy";

    throw new Error(`${reason}: ${command}`);
  }
}

export type CommandRiskLevel = "low" | "network" | "risky";

export function getCommandRiskLevel(command: string): CommandRiskLevel {
  const facts = commandRiskFacts(command);

  return facts.network ? "network" : facts.risky ? "risky" : "low";
}
