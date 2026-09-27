import {
  DatasetProfilePanel,
  UsabilityBadge,
  VerdictBadge,
  VerdictPanel,
} from "@ngriffin_uk/polychat-component-models";
import { Badge } from "@ngriffin_uk/polychat-component-ui";
import { useDataset } from "@ngriffin_uk/polychat-library-react";

import { ModelsSection } from "../ModelsSection.js";
import { DatasetRowBrowser } from "./DatasetRowBrowser.js";
import { ModelObjectPage } from "./ModelObjectPage.js";

export function DatasetView({
  workspaceId,
  versionId,
  projectId,
}: {
  workspaceId: string;
  versionId: string;
  projectId?: string;
}) {
  const dataset = useDataset(workspaceId, versionId);
  const data = dataset.data;
  const profile = data?.profile ?? null;

  return (
    <ModelObjectPage
      workspaceId={workspaceId}
      projectId={projectId}
      place="datasets"
      placeLabel="Datasets"
      title={data?.name}
      isLoading={dataset.isLoading}
      error={dataset.error}
    >
      {data && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {data.revision.slice(0, 16)}
            </span>
            {profile && <Badge variant="outline">{profile.collectionMethod}</Badge>}
            {profile && <Badge variant="outline">{profile.shape.replace("_", " ")}</Badge>}
            <VerdictBadge effect={data.verdict.effect} />
            <UsabilityBadge usable={data.usable} state={null} />
          </div>
          {profile?.status === "processing" && (
            <p className="text-sm text-muted-foreground">
              Processing. Profiles and rows appear when it finishes.
            </p>
          )}
          {profile?.status === "failed" && (
            <p className="text-sm text-failure">{profile.failureReason}</p>
          )}
          {profile?.status === "ready" && (
            <ModelsSection title="Profile">
              <DatasetProfilePanel profile={profile} />
            </ModelsSection>
          )}
          {profile && (
            <ModelsSection title="Governance" description={profile.sourceRef}>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>Licence: {profile.governance.licence}</div>
                <div>Lawful basis: {profile.governance.lawfulBasis.replaceAll("_", " ")}</div>
                <div>
                  Personal data:{" "}
                  {profile.governance.personalDataCategories.join(", ") || "none declared"}
                </div>
                <div>Customer data: {profile.governance.containsCustomerData ? "yes" : "no"}</div>
                <div className="sm:col-span-2">
                  Intended use: {profile.governance.intendedUse || "not recorded"}
                </div>
              </dl>
            </ModelsSection>
          )}
          <ModelsSection title="Policy verdict">
            <VerdictPanel verdict={data.verdict} />
          </ModelsSection>
          {profile?.status === "ready" && (
            <ModelsSection
              title="Rows"
              description="Read what the model will learn from. Exclusions cut a new revision; erasure also flags every model trained on it."
            >
              <DatasetRowBrowser key={versionId} versionId={versionId} />
            </ModelsSection>
          )}
        </div>
      )}
    </ModelObjectPage>
  );
}
