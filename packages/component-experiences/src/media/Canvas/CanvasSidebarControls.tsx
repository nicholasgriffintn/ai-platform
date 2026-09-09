import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { Brush, Film, Image } from "lucide-react";

import { DrawingSidebarControls } from "../Drawing/DrawingSidebarControls";
import { CanvasModelOptionControls } from "./CanvasModelOptionControls";
import type { CanvasStudioState } from "./controller";

export function CanvasSidebarControls({ canvas }: { canvas: CanvasStudioState }) {
  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="grid shrink-0 grid-cols-[repeat(3,minmax(0,1fr))] rounded-xl border border-border bg-surface p-1">
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
              <label
                htmlFor="canvas-prompt"
                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                Prompt
              </label>
              <textarea
                id="canvas-prompt"
                value={canvas.prompt}
                onChange={(event) => canvas.setPrompt(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-active-work"
                placeholder="Describe what to generate..."
              />
            </div>

            {canvas.mediaMode === "image" && (
              <div className="space-y-2">
                <label
                  htmlFor="canvas-negative-prompt"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Negative Prompt
                </label>
                <input
                  id="canvas-negative-prompt"
                  value={canvas.negativePrompt}
                  onChange={(event) => canvas.setNegativePrompt(event.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-active-work"
                  placeholder="Optional"
                />
              </div>
            )}

            {canvas.mediaMode === "image" && (
              <div className="space-y-2">
                <label
                  htmlFor="canvas-reference-images"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Reference Images
                </label>
                <textarea
                  id="canvas-reference-images"
                  value={canvas.referenceInput}
                  onChange={(event) => canvas.setReferenceInput(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-active-work"
                  placeholder="One URL per line"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="canvas-model-search"
                  className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  Models
                </label>
                <span className="text-xs text-muted-foreground">
                  {canvas.selectedModelIds.length} selected
                </span>
              </div>
              <input
                id="canvas-model-search"
                value={canvas.modelSearch}
                onChange={(event) => canvas.setModelSearch(event.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-active-work"
                placeholder="Search models"
              />

              <div className="max-h-60 space-y-2 overflow-auto rounded-xl border border-border bg-surface p-2">
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
                        <p className="mt-1 text-[11px] font-medium tracking-wide uppercase opacity-80">
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
                  <p className="px-2 py-3 text-xs text-muted-foreground">
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

          <div className="shrink-0 space-y-2 border-t border-border bg-surface/95 pt-2 backdrop-blur">
            {canvas.error && (
              <p role="alert" className="rounded-lg bg-failure/12 px-3 py-2 text-xs text-failure">
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
