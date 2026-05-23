import { Eraser, Redo2, Undo2 } from "lucide-react";

import { Button } from "~/components/ui";
import { ColorPicker } from "./ColorPicker";
import { LineWidthPicker } from "./LineWidthPicker";
import { ToolPicker } from "./ToolPicker";
import type { DrawingStudioState } from "./useDrawingStudio";

export function DrawingEditorControls({ drawing }: { drawing: DrawingStudioState }) {
	return (
		<div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
			<div className="space-y-2">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
					Tools
				</h3>
				<ToolPicker isFillMode={drawing.isFillMode} setIsFillMode={drawing.setIsFillMode} />
			</div>

			<div className="space-y-2">
				<h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
				<div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
					<p className="mb-1 font-medium">AI Guess</p>
					<p>{drawing.guessResult}</p>
				</div>
			)}
		</div>
	);
}
