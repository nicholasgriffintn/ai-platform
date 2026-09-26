import {
  DecisionList,
  EvidenceList,
  FileList,
  LineageList,
  RouteList,
  RouteSuggestionList,
  VerdictBadge,
  VerdictPanel,
  VersionAttributes,
  VersionEvalRunList,
} from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  ConfirmationDialog,
  OptionsMenu,
  OptionsMenuAction,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useModelLibrary,
  useModelPlatformMutations,
  useModelVersion,
  useRouteSuggestions,
} from "@ngriffin_uk/polychat-library-react";
import type { BomFormat, ModelDecision, VersionDetail } from "@ngriffin_uk/polychat-schemas";
import { shortenHash } from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { Download } from "lucide-react";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { DeployDialog } from "../flows/DeployDialog.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";
import { ModelObjectPage } from "./ModelObjectPage.js";

const EXPORTS = [
  {
    id: "cyclonedx",
    label: "CycloneDX AI BOM",
    description: "Components, lineage and evidence as JSON",
  },
  { id: "spdx", label: "SPDX AI BOM", description: "The same inventory in SPDX 3" },
  { id: "card", label: "Model card", description: "Markdown summary for readers" },
  {
    id: "training",
    label: "Training content summary",
    description: "What it was trained on, for the EU AI Act",
  },
] as const;

function ExportActions({ versionId }: { versionId: string }) {
  const { workspaceId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);

  const bom = (format: BomFormat) =>
    runWithToast("Bill of materials exported", async () => {
      const document = await mutations.exportBom.mutateAsync({ versionId, format });

      downloadTextFile(
        `ai-bom-${versionId}.${format === "spdx" ? "spdx" : "cdx"}.json`,
        JSON.stringify(document, null, 2),
        "application/json",
      );
    });
  const card = () =>
    runWithToast("Model card exported", async () => {
      const { markdown } = await mutations.exportCard.mutateAsync(versionId);

      downloadTextFile(`model-card-${versionId}.md`, markdown, "text/markdown");
    });
  const trainingContent = () =>
    runWithToast("Training content summary exported", async () => {
      const summary = await mutations.exportTrainingContent.mutateAsync(versionId);

      downloadTextFile(
        `training-content-${versionId}.json`,
        JSON.stringify(summary, null, 2),
        "application/json",
      );
    });

  return (
    <OptionsMenu
      align="end"
      className="min-w-64"
      trigger={
        <Button size="sm" variant="outline" icon={<Download size={14} />}>
          Export
        </Button>
      }
    >
      {EXPORTS.map((item) => (
        <OptionsMenuAction
          key={item.id}
          className="items-start"
          onSelect={() =>
            void (item.id === "card"
              ? card()
              : item.id === "training"
                ? trainingContent()
                : bom(item.id))
          }
        >
          <span className="flex min-w-0 flex-col gap-0.5 text-left">
            <span className="font-medium text-foreground">{item.label}</span>
            <span className="text-muted-foreground">{item.description}</span>
          </span>
        </OptionsMenuAction>
      ))}
    </OptionsMenu>
  );
}

function RevokeDialog({
  versionId,
  open,
  onOpenChange,
}: {
  versionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [reason, setReason] = useState("");

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Revoke this version"
      description="Approvals are revoked, routes retired, deployments paused and aliases cleared for this version and everything trained from it."
      confirmText="Revoke"
      variant="destructive"
      isLoading={mutations.revokeVersion.isPending}
      onConfirm={() =>
        void runWithToast(
          (result) =>
            `Revoked: ${result.retiredRouteIds.length} routes retired, ${result.pausedDeploymentIds.length} deployments paused`,
          () =>
            mutations.revokeVersion.mutateAsync({
              versionId,
              input: { reason: reason || "Revoked by a governor" },
            }),
        ).then(() => onOpenChange(false))
      }
    >
      <Textarea
        aria-label="Reason"
        placeholder="Why, for the audit trail"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="min-h-[60px] text-sm"
      />
    </ConfirmationDialog>
  );
}

function VersionBody({ data }: { data: VersionDetail }) {
  const { workspaceId, projectId, can, open } = useModelsScope();
  const versionId = data.version.id;
  const library = useModelLibrary(workspaceId, undefined, projectId);
  const suggestions = useRouteSuggestions(workspaceId, versionId, data.asset.kind === "model");
  const mutations = useModelPlatformMutations(workspaceId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"deploy" | "revoke" | null>(null);
  const entry = library.data?.find((item) => item.version.id === versionId);
  const usable = entry?.usable ?? false;
  const isBlocked = data.verdict.effect === "block";
  const names = Object.fromEntries(
    (library.data ?? []).map((item) => [
      item.version.id,
      `${item.asset.displayName}@${shortenHash(item.version.revision)}`,
    ]),
  );

  const resolve = async (decision: ModelDecision, state: "approved" | "rejected" | "revoked") => {
    setBusyId(decision.id);
    await runWithToast(`Decision ${state}`, () =>
      mutations.resolveDecision.mutateAsync({ decisionId: decision.id, input: { state } }),
    );
    setBusyId(null);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {data.asset.sourceRef} @ {shortenHash(data.version.revision)}
          </span>
          <Badge variant="outline">{data.asset.kind}</Badge>
          <Badge variant="outline">{data.asset.source}</Badge>
          <Badge variant={data.version.status === "failed" ? "destructive" : "outline"}>
            {data.version.status}
          </Badge>
          <VerdictBadge effect={data.verdict.effect} />
          {usable && <Badge variant="success">Usable here</Badge>}
        </div>
        {data.version.failureReason && (
          <p className="text-sm text-failure">{data.version.failureReason}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!usable && data.version.status === "ready" && (
            <Button
              size="sm"
              variant="primary"
              disabled={mutations.requestDecision.isPending}
              onClick={() =>
                void runWithToast(isBlocked ? "Exception requested" : "Approval requested", () =>
                  mutations.requestDecision.mutateAsync({
                    versionId,
                    projectId: projectId ?? null,
                    exception: isBlocked,
                  }),
                )
              }
            >
              {isBlocked ? "Request exception" : "Request approval"}
            </Button>
          )}
          {usable && data.asset.kind !== "dataset" && can("deploy") && (
            <Button size="sm" variant="secondary" onClick={() => setDialog("deploy")}>
              Deploy
            </Button>
          )}
          {can("import") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void runWithToast("Inspection queued", () =>
                  mutations.reinspect.mutateAsync(versionId),
                )
              }
            >
              Re-inspect
            </Button>
          )}
          <ExportActions versionId={versionId} />
          {can("approve") && (
            <Button size="sm" variant="destructive" onClick={() => setDialog("revoke")}>
              Revoke
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="evals">Evals</TabsTrigger>
          <TabsTrigger value="lineage">Lineage</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="activity">Decisions</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <ModelsSection
            title="Policy verdict"
            description="Every rule that applies to this version here, and why."
          >
            <VerdictPanel verdict={data.verdict} />
          </ModelsSection>
          <ModelsSection title="Attributes">
            <VersionAttributes detail={data} />
          </ModelsSection>
          {data.versions.length > 1 && (
            <ModelsSection title="Other versions">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {data.versions.map((version) => (
                  <li key={version.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/40"
                      onClick={() => open("versions", version.id)}
                    >
                      <span className="font-mono text-xs">{shortenHash(version.revision)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleDateString("en-GB")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ModelsSection>
          )}
        </TabsContent>

        <TabsContent value="evidence">
          <ModelsSection
            title="Evidence"
            description="Append-only findings from inspection, pipelines, evals and reviewers."
          >
            <EvidenceList evidence={data.evidence} />
          </ModelsSection>
        </TabsContent>

        <TabsContent value="evals">
          <ModelsSection title="Eval runs">
            <VersionEvalRunList runs={data.evalRuns} />
          </ModelsSection>
        </TabsContent>

        <TabsContent value="lineage">
          <ModelsSection title="Lineage" description="What this version came from and fed into.">
            <LineageList
              lineage={data.lineage}
              versionId={versionId}
              names={names}
              onOpenVersion={(id) => open("versions", id)}
            />
          </ModelsSection>
        </TabsContent>

        <TabsContent value="routes" className="space-y-8">
          <ModelsSection title="Serving routes">
            <RouteList
              routes={data.routes}
              canGovern={can("deploy")}
              onRetire={(route) =>
                void runWithToast("Route retired", () =>
                  mutations.retireRoute.mutateAsync(route.id),
                )
              }
            />
          </ModelsSection>
          {data.asset.kind === "model" && (
            <ModelsSection
              title="Available from providers"
              description="Catalogue providers already serving this model. Their weights are unverified until you deploy your own."
            >
              <RouteSuggestionList
                suggestions={suggestions.data ?? []}
                isRegistering={mutations.createRoute.isPending}
                onRegister={(suggestion) =>
                  void runWithToast("Route registered", () =>
                    mutations.createRoute.mutateAsync({
                      versionId,
                      provider: suggestion.provider,
                      providerModelId: suggestion.providerModelId,
                      region: suggestion.region,
                      weightsVerified: false,
                    }),
                  )
                }
              />
            </ModelsSection>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ModelsSection title="Decisions">
            <DecisionList
              decisions={data.decisions}
              canGovern={can("approve")}
              busyId={busyId}
              onResolve={(decision, state) => void resolve(decision, state)}
            />
          </ModelsSection>
        </TabsContent>

        <TabsContent value="files">
          <ModelsSection title="Files" description="Hashes pinned at import or upload.">
            <FileList files={data.files} />
          </ModelsSection>
        </TabsContent>
      </Tabs>

      <DeployDialog
        key={versionId}
        open={dialog === "deploy"}
        onOpenChange={(value) => setDialog(value ? "deploy" : null)}
        initialVersionId={data.asset.kind === "model" ? versionId : undefined}
      />
      <RevokeDialog
        versionId={versionId}
        open={dialog === "revoke"}
        onOpenChange={(value) => setDialog(value ? "revoke" : null)}
      />
    </div>
  );
}

export function ModelVersionView({
  workspaceId,
  versionId,
  projectId,
}: {
  workspaceId: string;
  versionId: string;
  projectId?: string;
}) {
  const detail = useModelVersion(workspaceId, versionId, projectId);

  return (
    <ModelObjectPage
      workspaceId={workspaceId}
      projectId={projectId}
      place="library"
      placeLabel="Models"
      title={detail.data?.asset.displayName}
      isLoading={detail.isLoading}
      error={detail.error}
    >
      {detail.data && <VersionBody data={detail.data} />}
    </ModelObjectPage>
  );
}
