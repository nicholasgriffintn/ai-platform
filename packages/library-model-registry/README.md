# @ngriffin_uk/polychat-library-model-registry

Governed model registry mechanisms. Contracts (`ModelVersion`, `PolicyRule`, `ModelDecision`, `EvalRun` and friends) live in `@ngriffin_uk/polychat-schemas`; this package owns the behaviour hosts apply to them. Nothing here touches storage or the network.

```ts
import {
  DEFAULT_WORKSPACE_POLICY_RULES,
  evaluatePolicies,
  isVerdictCovered,
  scanPickle,
  summarisePickleScan,
} from "@ngriffin_uk/polychat-library-model-registry";

const verdict = evaluatePolicies(subject, [
  { id: "ws", hash, scope: "workspace", rules: DEFAULT_WORKSPACE_POLICY_RULES },
]);
const usable = isVerdictCovered(verdict, approvals, new Date());
const { dangerous } = summarisePickleScan(scanPickle(bytes));
```

## API

- **Policy:** `evaluatePolicies`, `hashPolicyRules`, `isVerdictCovered` and `uncoveredMatches` (an approval covers the issues its approver saw), plus `DEFAULT_WORKSPACE_POLICY_RULES`. `metadataOnly` limits evaluation to rules that metadata can answer, for search previews.
- **Static inspection:** `readSafetensorsHeaderLength`, `parseSafetensorsHeader`, `parseGgufHeader`, `locateZipDirectory`, `parseZipDirectory`, `scanPickle` (opcode walk, never unpickles), `assessChatTemplate`, `assessRemoteCode`, `assessCard` and `collectWeightFormats`.
- **Datasets:** `assessPiiSample` and `countPii` (emails, phone numbers, Luhn-checked card numbers, UK NI numbers, IP addresses).
- **Evaluation:** `scoreDeterministic`, `buildJudgePrompt`, `parseJudgeScore`, `parseEvalCaseLines`, `summariseScores` (Wilson intervals for pass/fail, normal intervals otherwise) and `isMeaningfullyLower`.
- **Compute and lineage:** `estimateTrainingFlops`, `assessModificationCompute` (EU AI Act one-third threshold), `collectAncestry` and `buildMlBom` (CycloneDX 1.6).
- **Routes:** `resolveProviderRegion` and `matchesSourceReference`.
