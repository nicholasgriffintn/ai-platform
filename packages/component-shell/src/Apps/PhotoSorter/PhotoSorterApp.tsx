import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { RefreshCw, Trash2, Upload } from "lucide-react";

import { FileDropTarget } from "../FileDropTarget.js";
import { PileEditor } from "./PileEditor.js";
import { Polaroid } from "./Polaroid.js";
import { placedPileId, usePhotoSorter } from "./usePhotoSorter.js";

function EmptyTable({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    <FileDropTarget onFiles={onFiles} label="Choose images to sort" className="px-6 py-16">
      <div className="relative mx-auto mb-8 h-28 w-28" aria-hidden>
        {[-9, 4, -2].map((tilt, index) => (
          <span
            key={tilt}
            className="absolute inset-0 rounded-[3px] bg-card p-1.5 pb-6 shadow-[0_10px_24px_-14px_rgb(0_0_0/0.55)] ring-1 ring-border"
            style={{ rotate: `${tilt}deg`, translate: `${(index - 1) * 14}px ${index * 4}px` }}
          >
            <span className="block h-full w-full bg-accent-amber/15" />
          </span>
        ))}
      </div>
      <p className="font-display text-3xl">Tip the pile out here.</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Drop up to 80 images or click to choose. Each one develops as Clef Omni decides where it
        goes, and anything it is unsure of waits for you.
      </p>
    </FileDropTarget>
  );
}

export function PhotoSorterApp() {
  const sorter = usePhotoSorter();
  const pileIds = new Set(sorter.piles.map((pile) => pile.id));
  const developing = sorter.items.filter(
    (item) => item.state === "queued" || item.state === "sorting" || item.state === "failed",
  );
  const unsure = sorter.items.filter((item) => {
    const placed = placedPileId(item);

    return item.state === "sorted" && (placed === null || !pileIds.has(placed));
  });
  const sortedCount = sorter.items.filter((item) => item.state === "sorted").length;
  const progress = sorter.items.length > 0 ? sortedCount / sorter.items.length : 0;

  return (
    <div className="space-y-8">
      <PileEditor
        piles={sorter.piles}
        onRename={sorter.updatePile}
        onRemove={sorter.removePile}
        onAdd={sorter.addPile}
        onPreset={sorter.applyPreset}
      />

      {sorter.items.length === 0 ? (
        <EmptyTable onFiles={sorter.addFiles} />
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <FileDropTarget
                onFiles={sorter.addFiles}
                label="Choose images to sort"
                className="flex-1 px-4 py-3"
              >
                <span className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Upload size={15} /> Add more to the pile
                </span>
              </FileDropTarget>
              <Button
                variant="ghost"
                icon={<RefreshCw size={15} />}
                disabled={developing.length > 0}
                onClick={sorter.resortAll}
              >
                Re-sort with these piles
              </Button>
              <Button variant="ghost" icon={<Trash2 size={15} />} onClick={sorter.clear}>
                Clear table
              </Button>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-accent-amber transition-[width] duration-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="tabular-nums">
                {sortedCount}/{sorter.items.length} sorted
              </span>
            </div>
          </div>

          {(developing.length > 0 || unsure.length > 0) && (
            <section className="rounded-2xl border-2 border-dashed border-accent-amber/50 bg-accent-amber/5 p-5">
              <header className="mb-4 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-2xl italic">Your call</h3>
                <span className="text-xs text-muted-foreground">
                  {unsure.length > 0
                    ? `${unsure.length} it would rather not guess`
                    : "Developing the rest"}
                </span>
              </header>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 xl:grid-cols-6">
                {developing.map((item) => (
                  <Polaroid key={item.id} item={item} />
                ))}
                {unsure.map((item) => (
                  <Polaroid key={item.id} item={item}>
                    <div className="flex flex-wrap gap-1 px-0.5 pt-1.5">
                      {sorter.piles.map((pile) => (
                        <button
                          key={pile.id}
                          type="button"
                          onClick={() => sorter.moveTo(item.id, pile.id)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] transition-colors hover:border-accent-amber hover:text-foreground",
                            item.state === "sorted" && item.result.bestGuess === pile.id
                              ? "border-accent-amber/60 text-foreground"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {pile.label}
                        </button>
                      ))}
                    </div>
                  </Polaroid>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {sorter.piles.map((pile) => {
              const filed = sorter.items.filter((item) => placedPileId(item) === pile.id);

              return (
                <section key={pile.id} className="space-y-4">
                  <header className="flex items-baseline justify-between border-b border-border pb-2">
                    <h3 className="font-display text-xl">{pile.label}</h3>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {filed.length}
                    </span>
                  </header>
                  {filed.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground italic">
                      Nothing here yet
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {filed.map((item) => (
                        <Polaroid key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
