import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  getFilesPath,
  useAddOutputToCollection,
  useOutputMutations,
  useSources,
} from "@ngriffin_uk/polychat-library-react";
import {
  READING_FORMS,
  readKnowledgeEnrichment,
  readSourceReading,
  SHEET_CAPABILITY_ID,
  SHEET_OUTPUT_KIND,
  type SourceCollection,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { formatCsv, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { Download, Table2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Readout } from "../../Apps/Decisions/Readout.js";
import { buildReadingSheet, readingCsvRecords, readRows, readTotal } from "../Reading/reading.js";

function rowStatus(source: SourceSummary): string {
  const state = readKnowledgeEnrichment(source.metadata, "reading");

  if (state?.status === "failed") {
    return state.error ?? "Couldn't read this one";
  }

  return state?.status === "skipped" ? "Nothing to read" : "Waiting to be read";
}

export function FolderLedger({
  folder,
  basePath,
  projectId,
}: {
  folder: SourceCollection & { readAs: NonNullable<SourceCollection["readAs"]> };
  basePath: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const { data: files = [] } = useSources({ projectId, collectionId: folder.id });
  const outputs = useOutputMutations();
  const addToFolder = useAddOutputToCollection();
  const form = READING_FORMS[folder.readAs];
  const entries = files
    .filter((file) => file.kind !== "memory" && file.kind !== "podcast")
    .map((file) => {
      const reading = readSourceReading(file.metadata);

      return { file, reading: reading?.form === form.id ? reading : null };
    });
  const readings = entries.flatMap(({ file, reading }) =>
    reading ? [{ name: file.title, answers: reading.answers }] : [],
  );
  const total = readings.reduce((sum, { answers }) => sum + (readTotal(form, answers) ?? 0), 0);
  const secondLooks = readings.reduce(
    (count, { answers }) => count + readRows(form, answers).filter((row) => row.needsLook).length,
    0,
  );
  const saveSheet = async () => {
    try {
      const sheet = await outputs.create.mutateAsync({
        projectId: projectId ?? null,
        capabilityId: SHEET_CAPABILITY_ID,
        kind: SHEET_OUTPUT_KIND,
        status: "ready",
        title: `${folder.title} ${form.label.toLowerCase()}`.slice(0, 200),
        content: buildReadingSheet(form, readings),
      });

      await addToFolder.mutateAsync({ collectionId: folder.id, outputId: sheet.id });
      toast.success("Saved as a sheet in this folder");
      void navigate(getFilesPath(basePath, "made", encodeURIComponent(sheet.id)));
    } catch (error) {
      toast.error(getErrorMessage(error, "The sheet didn't save"));
    }
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="folder-ledger-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-6 border-y border-border py-5">
        <div className="flex flex-wrap gap-10">
          <Readout label="Read" value={`${readings.length}/${entries.length}`} />
          <Readout label="Total" value={total.toFixed(2)} />
          <Readout label="Second looks" value={String(secondLooks)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<Download size={15} />}
            disabled={readings.length === 0}
            onClick={() =>
              downloadTextFile(
                `${folder.title.replace(/\s+/g, "-")}-${form.id}s.csv`,
                formatCsv(readingCsvRecords(form, readings)),
                "text/csv",
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Table2 size={15} />}
            disabled={readings.length === 0}
            isLoading={outputs.create.isPending || addToFolder.isPending}
            onClick={() => void saveSheet()}
          >
            Save as sheet
          </Button>
        </div>
      </div>
      <h3 id="folder-ledger-heading" className="sr-only">
        {form.label} in this folder
      </h3>
      <p className="-mt-2 text-xs text-muted-foreground">
        The total is added up here rather than by the model. It reads well but does sums like a
        parrot.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/40 text-left text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                File
              </th>
              {form.fields.map((field) => (
                <th key={field.name} scope="col" className="px-3 py-2 font-medium">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(({ file, reading }) => (
              <tr key={file.id} className="border-t border-border/60 align-baseline">
                <th scope="row" className="max-w-[14rem] px-3 py-2 text-left font-normal">
                  <button
                    type="button"
                    className="max-w-full truncate text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() =>
                      void navigate(getFilesPath(basePath, "sources", encodeURIComponent(file.id)))
                    }
                  >
                    {file.title}
                  </button>
                </th>
                {reading ? (
                  readRows(form, reading.answers).map((row) => (
                    <td
                      key={row.name}
                      className={cn(
                        "px-3 py-2 font-mono tabular-nums",
                        row.found ? "text-foreground" : "text-muted-foreground italic",
                        row.needsLook && "bg-attention/10",
                      )}
                      title={row.needsLook ? "Worth a second look" : undefined}
                    >
                      {row.value}
                    </td>
                  ))
                ) : (
                  <td colSpan={form.fields.length} className="px-3 py-2 text-muted-foreground">
                    {rowStatus(file)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
