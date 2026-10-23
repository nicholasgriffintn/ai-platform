import { Button, cn, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { formatCsv } from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { Download, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Readout } from "../Decisions/Readout.js";
import { FileDropTarget } from "../FileDropTarget.js";
import { PAPERWORK_FORMS } from "./forms.js";
import { paperworkCsvRecords, readRows, readTotal } from "./reading.js";
import { ReadingCard } from "./ReadingCard.js";
import { usePaperwork } from "./usePaperwork.js";

function PasteBox({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(text);
        setText("");
      }}
    >
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        placeholder="Or paste an invoice, an order email or a complaint about a dented corner"
        aria-label="Paste text to read"
      />
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          Read this
        </Button>
      </div>
    </form>
  );
}

export function PaperworkApp() {
  const paperwork = usePaperwork();
  const { form, documents } = paperwork;
  const readings = documents.flatMap((document) =>
    document.state === "read" ? [{ name: document.name, response: document.response }] : [],
  );
  const total = readings.reduce((sum, { response }) => sum + (readTotal(form, response) ?? 0), 0);
  const secondLooks = readings.reduce(
    (count, { response }) => count + readRows(form, response).filter((row) => row.needsLook).length,
    0,
  );
  const exportCsv = () =>
    downloadTextFile(`${form.id}s.csv`, formatCsv(paperworkCsvRecords(form, readings)), "text/csv");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">What are you reading</legend>
          {PAPERWORK_FORMS.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === form.id}
              onClick={() => candidate.id !== form.id && paperwork.chooseForm(candidate)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                candidate.id === form.id
                  ? "border-accent-sky bg-accent-sky/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-accent-sky/60",
              )}
            >
              {candidate.label}
            </button>
          ))}
        </fieldset>
        <p className="text-sm text-muted-foreground">{form.hint}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FileDropTarget
          onFiles={paperwork.addFiles}
          label="Choose images to read"
          accent="sky"
          className="px-6 py-10"
        >
          <Upload className="mx-auto mb-3 text-accent-sky" size={22} aria-hidden />
          <p className="font-display text-2xl">Hand over the paperwork.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Drop photos or scans, up to 24. Clairic reads every field in one pass and says how sure
            it is about each figure.
          </p>
        </FileDropTarget>
        <PasteBox onSubmit={paperwork.addText} />
      </div>

      {documents.length > 0 && (
        <>
          <section className="flex flex-wrap items-end justify-between gap-6 border-y border-border py-5">
            <div className="flex flex-wrap gap-10">
              <Readout label="Read" value={`${readings.length}/${documents.length}`} />
              <Readout label="Total" value={total.toFixed(2)} />
              <Readout label="Second looks" value={String(secondLooks)} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                icon={<Download size={15} />}
                disabled={readings.length === 0}
                onClick={exportCsv}
              >
                Export CSV
              </Button>
              <Button variant="ghost" icon={<Trash2 size={15} />} onClick={paperwork.clear}>
                Clear desk
              </Button>
            </div>
          </section>
          <p className="-mt-6 text-xs text-muted-foreground">
            The total is added up here rather than by the model. It reads well but does sums like a
            parrot.
          </p>

          <div className="space-y-4">
            {documents.map((document) => (
              <ReadingCard key={document.id} document={document} form={form} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
