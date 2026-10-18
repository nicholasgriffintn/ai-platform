import {
  blockingSkillScanFindings,
  scanSkillDocument,
  type SkillScanFinding,
  type SkillScanInput,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

export type SkillScanStage = "promote" | "import";

const STAGE_VERBS: Record<SkillScanStage, string> = {
  promote: "promoted",
  import: "imported",
};

function describeFinding(finding: SkillScanFinding): string {
  return `${finding.location}: ${finding.message}`;
}

export function assertSkillPassesScan(document: SkillScanInput, stage: SkillScanStage): void {
  const blocking = blockingSkillScanFindings(scanSkillDocument(document));

  if (blocking.length === 0) {
    return;
  }

  throw new AssistantError(
    `Skill cannot be ${STAGE_VERBS[stage]} until these are fixed: ${blocking
      .map(describeFinding)
      .join("; ")}`,
    ErrorType.PARAMS_ERROR,
    400,
    { findings: blocking },
  );
}
