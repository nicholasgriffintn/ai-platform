import {
  Badge,
  Button,
  CardSkeleton,
  FormSelect,
  Switch,
} from "@ngriffin_uk/polychat-component-ui";
import { useDatasetRows, useModelPlatformMutations } from "@ngriffin_uk/polychat-library-react";
import type { DatasetSplit } from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

import { runWithToast } from "../../../utils/toast-action.js";
import { useModelsScope } from "../ModelsScope.js";

const PAGE = 25;

export function DatasetRowBrowser({ versionId }: { versionId: string }) {
  const { workspaceId, can, open: openObject } = useModelsScope();
  const mutations = useModelPlatformMutations(workspaceId);
  const [split, setSplit] = useState<DatasetSplit>("train");
  const [offset, setOffset] = useState(0);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const rows = useDatasetRows(workspaceId, versionId, { split, offset, limit: PAGE, flaggedOnly });
  const total = rows.data?.total ?? 0;
  const isPending = mutations.excludeRows.isPending || mutations.requestErasure.isPending;

  const exclude = async () => {
    const result = await runWithToast("Rows excluded from a new revision", () =>
      mutations.excludeRows.mutateAsync({
        versionId,
        input: { split, indexes: selected, reason: "Excluded during review" },
      }),
    );

    if (result) {
      setSelected([]);
      openObject("datasets", result.versionId);
    }
  };

  const erase = async (action: "retrain_by" | "withdraw") => {
    const result = await runWithToast(
      (erasure) =>
        `Erased; ${erasure.affectedVersionIds.length} models ${action === "withdraw" ? "withdrawn" : "due for retraining"}`,
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
    );

    if (result) {
      setSelected([]);
      openObject("datasets", result.datasetVersionId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <FormSelect
          aria-label="Split"
          fullWidth={false}
          className="w-44"
          value={split}
          disabled={isPending}
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
          disabled={isPending}
          onChange={(event) => {
            setFlaggedOnly(event.target.checked);
            setOffset(0);
            setSelected([]);
          }}
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
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => void exclude()}
              >
                Exclude
              </Button>
            )}
            {can("approve") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => void erase("retrain_by")}
                >
                  Erase, retrain within 30 days
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => void erase("withdraw")}
                >
                  Erase and withdraw models
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {rows.isLoading ? (
        <CardSkeleton />
      ) : rows.error ? (
        <p className="text-sm text-failure">
          {getErrorMessage(rows.error, "Could not load dataset rows")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(rows.data?.rows ?? []).map((row) => (
            <li key={row.index} className="flex gap-3 px-3 py-2 text-xs">
              <input
                type="checkbox"
                aria-label={`Select row ${row.index}`}
                checked={selected.includes(row.index)}
                disabled={isPending}
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
