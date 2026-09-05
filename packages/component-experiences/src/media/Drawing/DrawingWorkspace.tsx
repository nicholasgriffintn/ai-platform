import { Image } from "@ngriffin_uk/polychat-component-content";
import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { Brush, ChevronLeft } from "lucide-react";

import type { DrawingStudioState } from "./controller";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingEditorControls } from "./DrawingEditorControls";
import { DrawingView } from "./DrawingView";

export function DrawingWorkspace({ drawing }: { drawing: DrawingStudioState }) {
  if (drawing.isEditorOpen) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">New Drawing</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <DrawingEditorControls drawing={drawing} />
          <div className="border-border bg-surface relative rounded-xl border p-3 shadow-sm">
            <DrawingCanvas
              canvasRef={drawing.canvasRef}
              isFillMode={drawing.isFillMode}
              currentColor={drawing.currentColor}
              lineWidth={drawing.lineWidth}
              saveToHistory={drawing.saveToHistory}
              onDrawingComplete={drawing.handleDrawingComplete}
              drawingData={
                drawing.currentHistoryIndex >= 0
                  ? drawing.drawingHistory[drawing.currentHistoryIndex]
                  : undefined
              }
            />

            {drawing.isProcessing && (
              <div className="absolute inset-3 flex items-center justify-center rounded-lg bg-foreground text-background">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-surface" />
                  <p className="mt-2 text-sm">Processing...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (drawing.selectedDrawingId) {
    if (drawing.isSelectedDrawingLoading) {
      return (
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-active-work" />
        </div>
      );
    }

    if (drawing.selectedDrawingError || !drawing.selectedDrawing) {
      return (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-muted-foreground">
          <p>Drawing not found</p>
          <Button variant="secondary" onClick={drawing.showDrawingList}>
            Back to drawings
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Button
          variant="secondary"
          icon={<ChevronLeft size={16} />}
          onClick={drawing.showDrawingList}
        >
          Back to Drawings
        </Button>
        <DrawingView drawing={drawing.selectedDrawing} />
      </div>
    );
  }

  if (drawing.isDrawingsLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`drawing-loading-${index}`}
            className="bg-selection h-56 animate-pulse rounded-xl"
          />
        ))}
      </div>
    );
  }

  if (drawing.drawingsError) {
    return (
      <div className="rounded-lg border border-attention/45 bg-attention/12 p-4 text-attention">
        <p className="font-medium">Failed to load drawings</p>
        <p className="text-sm">
          {drawing.drawingsError instanceof Error
            ? drawing.drawingsError.message
            : "Unknown error occurred"}
        </p>
      </div>
    );
  }

  if (drawing.drawings.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border-strong text-muted-foreground">
        <Brush className="mb-2 h-6 w-6" />
        <p>Create your first drawing from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {drawing.drawings.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => drawing.setSelectedDrawingId(item.id)}
          className={cn(
            "border-border bg-surface hover:border-border-strong rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md",
          )}
        >
          <div className="bg-selection relative mb-3 aspect-video w-full overflow-hidden rounded-lg">
            {item.paintingUrl ? (
              <Image
                src={item.paintingUrl}
                alt={item.description || "Drawing"}
                className="h-full w-full object-cover"
                crossOrigin="use-credentials"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Brush size={30} className="text-muted-foreground" />
              </div>
            )}
          </div>
          <h3 className="line-clamp-2 font-semibold text-foreground">
            {item.description || "Untitled Drawing"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Created {new Date(item.createdAt).toLocaleDateString()}
          </p>
        </button>
      ))}
    </div>
  );
}
