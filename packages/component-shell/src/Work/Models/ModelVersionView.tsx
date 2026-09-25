import {
  DecisionList,
  EvidenceList,
  FileList,
  HuggingFaceWriteHint,
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
  CardSkeleton,
  EmptyState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useHuggingFaceConnection,
  useModelLibrary,
  useModelRegistryMutations,
  useModelVersion,
  useRouteSuggestions,
} from "@ngriffin_uk/polychat-library-react";
import type { ModelDecision } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage, shortenHash } from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageShell } from "../../Shell/PageShell.js";
import { useWorkData } from "../WorkDataContext.js";
import { modelsPath, modelVersionPath } from "./modelPaths.js";
import { ModelsSection } from "./ModelsSection.js";

export function ModelVersionView({
  workspaceId,
  versionId,
  projectId,
}: {
  workspaceId: string;
  versionId: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const { workspaceQuery } = useWorkData();
  const canGovern = workspaceQuery.data?.role === "owner" || workspaceQuery.data?.role === "admin";
  const detail = useModelVersion(workspaceId, versionId, projectId);
  const library = useModelLibrary(workspaceId, projectId);
  const suggestions = useRouteSuggestions(
    workspaceId,
    versionId,
    detail.data?.asset.kind === "model",
  );
  const mutations = useModelRegistryMutations(workspaceId);
  const canDeploy = useHuggingFaceConnection(workspaceId).data?.canTrainAndDeploy ?? false;
  const [busyId, setBusyId] = useState<string | null>(null);

  if (detail.isLoading) {
    return (
      <PageShell.Content className="max-w-6xl">
        <CardSkeleton />
      </PageShell.Content>
    );
  }

  if (!detail.data) {
    return (
      <EmptyState
        title="Version not found"
        message={getErrorMessage(detail.error, "This version is not in the workspace library.")}
        className="min-h-[240px]"
      />
    );
  }

  const data = detail.data;
  const entry = library.data?.find((item) => item.version.id === versionId);
  const usable = entry?.usable ?? false;
  const names = Object.fromEntries(
    (library.data ?? []).map((item) => [
      item.version.id,
      `${item.asset.displayName}@${shortenHash(item.version.revision)}`,
    ]),
  );
  const openVersion = (id: string) => void navigate(modelVersionPath(workspaceId, id, projectId));
  const run = async (label: string, work: () => Promise<unknown>) => {
    try {
      await work();
      toast.success(label);
    } catch (error) {
      toast.error(getErrorMessage(error, "That did not work"));
    }
  };

  const resolve = async (decision: ModelDecision, state: "approved" | "rejected" | "revoked") => {
    setBusyId(decision.id);
    await run(`Decision ${state}`, () =>
      mutations.resolveDecision.mutateAsync({ decisionId: decision.id, input: { state } }),
    );
    setBusyId(null);
  };

  const exportBom = () =>
    run("ML-BOM exported", async () => {
      const bom = await mutations.exportBom.mutateAsync({ versionId });

      downloadTextFile(
        `ml-bom-${versionId}.cdx.json`,
        JSON.stringify(bom, null, 2),
        "application/json",
      );
    });
  const isBlocked = data.verdict.effect === "block";

  const canRequest = !usable && data.version.status === "ready";
  const canOfferDeploy = usable && data.asset.kind === "model";

  return (
    <PageShell.Content className="max-w-6xl">
      <PageShell.Header title={data.asset.displayName} />
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigate(modelsPath(workspaceId, projectId))}
            >
              ← Models
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {data.asset.sourceRef} @ {shortenHash(data.version.revision)}
            </span>
            <Badge variant="outline">{data.asset.kind}</Badge>
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
            {canRequest && (
              <Button
                size="sm"
                variant="primary"
                disabled={mutations.requestDecision.isPending}
                onClick={() =>
                  void run(isBlocked ? "Exception requested" : "Approval requested", () =>
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
            {canOfferDeploy && (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canDeploy || mutations.deployVersion.isPending}
                onClick={() =>
                  void run("Endpoint requested. Evals start once it is up.", () =>
                    mutations.deployVersion.mutateAsync({
                      versionId,
                      input: { projectId: projectId ?? null },
                    }),
                  )
                }
              >
                Deploy to a dedicated endpoint
              </Button>
            )}
            {canGovern && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void run("Inspection queued", () => mutations.reinspect.mutateAsync(versionId))
                }
              >
                Re-inspect
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void exportBom()}>
              Export ML-BOM
            </Button>
          </div>
          {canOfferDeploy && !canDeploy && <HuggingFaceWriteHint action="A dedicated endpoint" />}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="evals">Evals</TabsTrigger>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <ModelsSection
              title="Policy verdict"
              description="Every rule that applies to this version here, and why."
              actions={<VerdictBadge effect={data.verdict.effect} />}
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
                        onClick={() => openVersion(version.id)}
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
              description="Append-only findings from inspection, evals and reviewers."
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
                onOpenVersion={openVersion}
              />
            </ModelsSection>
          </TabsContent>

          <TabsContent value="routes" className="space-y-8">
            <ModelsSection title="Serving routes">
              <RouteList
                routes={data.routes}
                canGovern={canGovern}
                onRetire={(route) =>
                  void run("Route retired", () => mutations.retireRoute.mutateAsync(route.id))
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
                    void run("Route registered", () =>
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
                canGovern={canGovern}
                busyId={busyId}
                onResolve={(decision, state) => void resolve(decision, state)}
              />
            </ModelsSection>
          </TabsContent>

          <TabsContent value="files">
            <ModelsSection title="Files" description="Hashes pinned at import.">
              <FileList files={data.files} />
            </ModelsSection>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell.Content>
  );
}
