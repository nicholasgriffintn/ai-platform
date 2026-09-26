import {
  DatasetProfilePanel,
  UsabilityBadge,
  VerdictBadge,
  VerdictPanel,
} from "@ngriffin_uk/polychat-component-models";
import {
  Badge,
  Button,
  CardSkeleton,
  FormSelect,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import {
  useDataset,
  useDatasetRows,
  useModelPlatformMutations,
} from "@ngriffin_uk/polychat-library-react";
import type { DatasetSplit } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";
import { ModelsSection } from "../ModelsSection.js";
import { ModelObjectPage } from "./ModelObjectPage.js";

const PAGE = 25;

function RowBrowser({ versionId }: { versionId: string }) {
  const { workspaceId, can } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [split, setSplit] = useState<DatasetSplit>("train");
  const [offset, setOffset] = useState(0);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const rows = useDatasetRows(workspaceId, versionId, { split, offset, limit: PAGE, flaggedOnly });
  const total = rows.data?.total ?? 0;

  const exclude = () =>
    runWithToast("Excluded; a new revision is processing", () =>
      mutations.excludeRows.mutateAsync({
        versionId,
        input: { split, indexes: selected, reason: "Excluded during review" },
      }),
    ).then(() => setSelected([]));

  const erase = (action: "retrain_by" | "withdraw") =>
    runWithToast(
      (result) =>
        `Erased; ${result.affectedVersionIds.length} models ${action === "withdraw" ? "withdrawn" : "due for retraining"}`,
      () =>
        mutations.requestErasure.mutateAsync({
          versionId,
          input: {
            split,
            indexes: selected,
            reason: "Data subject erasure request",
            action,
            dueInDays: 30,
          },
        }),
    ).then(() => setSelected([]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <FormSelect
          aria-label="Split"
          fullWidth={false}
          className="w-44"
          value={split}
          onValueChange={(value) => {
            setSplit(value);
            setOffset(0);
            setSelected([]);
          }}
          options={[
            { value: "train", label: "Training rows" },
            { value: "validation", label: "Validation rows" },
            { value: "test", label: "Test rows" },
          ]}
        />
        <Switch
          label="Flagged only"
          checked={flaggedOnly}
          onChange={(event) => setFlaggedOnly(event.target.checked)}
        />
      </div>
      {selected.length > 0 && (can("build_datasets") || can("approve")) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} row{selected.length === 1 ? "" : "s"} selected
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {can("build_datasets") && (
              <Button size="sm" variant="outline" onClick={() => void exclude()}>
                Exclude
              </Button>
            )}
            {can("approve") && (
              <>
                <Button size="sm" variant="outline" onClick={() => void erase("retrain_by")}>
                  Erase, retrain within 30 days
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void erase("withdraw")}>
                  Erase and withdraw models
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {rows.isLoading ? (
        <CardSkeleton />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(rows.data?.rows ?? []).map((row) => (
            <li key={row.index} className="flex gap-3 px-3 py-2 text-xs">
              <input
                type="checkbox"
                aria-label={`Select row ${row.index}`}
                checked={selected.includes(row.index)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, row.index]
                      : current.filter((index) => index !== row.index),
                  )
                }
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap gap-1">
                  <span className="font-mono text-muted-foreground">#{row.index}</span>
                  {row.flags.map((flag) => (
                    <Badge key={flag} variant="warning">
                      {flag}
                    </Badge>
                  ))}
                </div>
                <pre className="max-h-40 overflow-auto font-mono whitespace-pre-wrap">
                  {JSON.stringify(row.record, null, 2)}
                </pre>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button
          size="sm"
          variant="ghost"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE))}
        >
          Previous
        </Button>
        <span>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} of {total}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={offset + PAGE >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

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
              <RowBrowser versionId={versionId} />
            </ModelsSection>
          )}
        </div>
      )}
    </ModelObjectPage>
  );
}
