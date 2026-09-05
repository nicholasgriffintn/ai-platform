import { Button } from "@ngriffin_uk/polychat-component-ui";
import { Eraser, Redo2, Undo2 } from "lucide-react";

import { ColorPicker } from "./ColorPicker";
import type { DrawingStudioState } from "./controller";
import { LineWidthPicker } from "./LineWidthPicker";
import { ToolPicker } from "./ToolPicker";

export function DrawingEditorControls({ drawing }: { drawing: DrawingStudioState }) {
  return (
    <div className="border-border bg-surface space-y-4 rounded-xl border p-4 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tools
        </h3>
        <ToolPicker isFillMode={drawing.isFillMode} setIsFillMode={drawing.setIsFillMode} />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Colours
        </h3>
        <ColorPicker
          currentColor={drawing.currentColor}
          setCurrentColor={drawing.setCurrentColor}
        />
      </div>

      <LineWidthPicker lineWidth={drawing.lineWidth} setLineWidth={drawing.setLineWidth} />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          icon={<Undo2 size={15} />}
          onClick={drawing.undoDrawing}
          disabled={drawing.isProcessing || drawing.currentHistoryIndex <= 0}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          icon={<Redo2 size={15} />}
          onClick={drawing.redoDrawing}
          disabled={
            drawing.isProcessing || drawing.currentHistoryIndex >= drawing.drawingHistory.length - 1
          }
        >
          Redo
        </Button>
      </div>

      <Button
        variant="outline"
        fullWidth
        icon={<Eraser size={15} />}
        onClick={drawing.clearCanvas}
        disabled={drawing.isProcessing}
      >
        Clear
      </Button>

      <div className="space-y-2">
        <Button
          variant="outline"
          fullWidth
          onClick={() => void drawing.handleGuess()}
          disabled={drawing.isProcessing || !drawing.preview}
        >
          Guess What I Drew
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => void drawing.handleGenerate()}
          disabled={drawing.isProcessing || !drawing.preview}
          isLoading={drawing.isProcessing}
        >
          Transform Drawing
        </Button>
      </div>

      {drawing.guessResult && (
        <div className="rounded-lg bg-active-work/12 px-3 py-2 text-xs text-active-work">
          <p className="mb-1 font-medium">AI Guess</p>
          <p>{drawing.guessResult}</p>
        </div>
      )}
    </div>
  );
}
