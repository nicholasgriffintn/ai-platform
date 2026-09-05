import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { Brush, Film, Image } from "lucide-react";

import { DrawingSidebarControls } from "../Drawing/DrawingSidebarControls";
import { CanvasModelOptionControls } from "./CanvasModelOptionControls";
import type { CanvasStudioState } from "./controller";

export function CanvasSidebarControls({ canvas }: { canvas: CanvasStudioState }) {
  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="border-border bg-surface shrink-0 grid grid-cols-[repeat(3,minmax(0,1fr))] rounded-xl border p-1">
        <button
          type="button"
          aria-label="Image generation"
          title="Image generation"
          onClick={() => canvas.handleModeChange("image")}
          className={cn(
            "box-border flex h-10 w-full min-w-0 items-center justify-center rounded-lg border border-transparent p-2 transition",
            canvas.mode === "image"
              ? "bg-creative/15 text-creative"
              : "text-muted-foreground hover:bg-selection/60 hover:text-foreground",
          )}
        >
          <Image className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Video generation"
          title="Video generation"
          onClick={() => canvas.handleModeChange("video")}
          className={cn(
            "box-border flex h-10 w-full min-w-0 items-center justify-center rounded-lg border border-transparent p-2 transition",
            canvas.mode === "video"
              ? "bg-creative/15 text-creative"
              : "text-muted-foreground hover:bg-selection/60 hover:text-foreground",
          )}
        >
          <Film className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Drawing"
          title="Drawing"
          onClick={() => canvas.handleModeChange("drawing")}
          className={cn(
            "box-border flex h-10 w-full min-w-0 items-center justify-center rounded-lg border border-transparent p-2 transition",
            canvas.mode === "drawing"
              ? "bg-creative/15 text-creative"
              : "text-muted-foreground hover:bg-selection/60 hover:text-foreground",
          )}
        >
          <Brush className="h-5 w-5" />
        </button>
      </div>

      {canvas.mode === "drawing" && (
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          <DrawingSidebarControls drawing={canvas.drawing} />
        </div>
      )}

      {canvas.mode !== "drawing" && (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4 pb-4">
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Prompt
              </label>
              <textarea
                value={canvas.prompt}
                onChange={(event) => canvas.setPrompt(event.target.value)}
                rows={4}
                className="border-border bg-surface text-foreground focus:border-active-work w-full rounded-xl border px-3 py-2 text-sm outline-none"
                placeholder="Describe what to generate..."
              />
            </div>

            {canvas.mediaMode === "image" && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Negative Prompt
                </label>
                <input
                  value={canvas.negativePrompt}
                  onChange={(event) => canvas.setNegativePrompt(event.target.value)}
                  className="border-border bg-surface text-foreground focus:border-active-work w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  placeholder="Optional"
                />
              </div>
            )}

            {canvas.mediaMode === "image" && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Reference Images
                </label>
                <textarea
                  value={canvas.referenceInput}
                  onChange={(event) => canvas.setReferenceInput(event.target.value)}
                  rows={3}
                  className="border-border bg-surface text-foreground focus:border-active-work w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  placeholder="One URL per line"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Models
                </label>
                <span className="text-muted-foreground text-xs">
                  {canvas.selectedModelIds.length} selected
                </span>
              </div>
              <input
                value={canvas.modelSearch}
                onChange={(event) => canvas.setModelSearch(event.target.value)}
                className="border-border bg-surface text-foreground focus:border-active-work w-full rounded-xl border px-3 py-2 text-sm outline-none"
                placeholder="Search models"
              />

              <div className="border-border bg-surface max-h-60 space-y-2 overflow-auto rounded-xl border p-2">
                {canvas.visibleModels.map((model) => {
                  const selected = canvas.selectedModelIds.includes(model.id);

                  return (
                    <button
                      type="button"
                      key={model.id}
                      onClick={() => canvas.handleModelToggle(model.id)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition",
                        selected
                          ? "border-active-work/50 bg-selection text-foreground"
                          : "border-border bg-surface text-foreground hover:bg-selection/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 text-sm font-medium">{model.name}</span>
                        <span className="shrink-0 text-xs uppercase">{model.provider}</span>
                      </div>
                      {model.requiresReferenceImage && (
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
                          Requires reference image
                        </p>
                      )}
                      {typeof model.costPerRun === "number" && (
                        <p className="mt-1 text-xs opacity-80">${model.costPerRun.toFixed(3)}</p>
                      )}
                    </button>
                  );
                })}
                {!canvas.isModelsLoading && canvas.visibleModels.length === 0 && (
                  <p className="text-muted-foreground px-2 py-3 text-xs">
                    No models match this filter.
                  </p>
                )}
              </div>
            </div>

            <CanvasModelOptionControls
              fields={canvas.modelOptionFields}
              values={canvas.modelOptionValues}
              onChange={canvas.setModelOptionValue}
            />
          </div>

          <div className="border-border bg-surface/95 shrink-0 space-y-2 border-t pt-2 backdrop-blur">
            {canvas.error && (
              <p role="alert" className="bg-failure/12 text-failure rounded-lg px-3 py-2 text-xs">
                {canvas.error instanceof Error
                  ? canvas.error.message
                  : "Could not load Canvas resources."}
              </p>
            )}

            <Button
              variant="primary"
              onClick={() => void canvas.handleGenerate()}
              disabled={canvas.selectedModelIds.length === 0 || !canvas.prompt.trim()}
              isLoading={canvas.isGenerating}
              fullWidth
            >
              Generate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
