import { useWorkData } from "../../WorkDataContext.js";
import { AuditSection, PermissionsSection } from "../governance/AccessSections.js";
import { ProvidersSection } from "../governance/ProvidersSection.js";
import { DecisionSections, PolicySections } from "../governance/ReviewSections.js";
import { SpendSection } from "../governance/SpendSection.js";

export function GovernancePlace() {
  const { projectQuery } = useWorkData();

  return (
    <div className="space-y-8">
      <DecisionSections />
      <SpendSection />
      <ProvidersSection />
      <PolicySections projectName={projectQuery.data?.name} />
      <PermissionsSection />
      <AuditSection />
    </div>
  );
}
