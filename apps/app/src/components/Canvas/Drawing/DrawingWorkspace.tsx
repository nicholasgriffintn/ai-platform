import { Brush, ChevronLeft } from "lucide-react";

import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingEditorControls } from "./DrawingEditorControls";
import { DrawingView } from "./DrawingView";
import type { DrawingStudioState } from "./useDrawingStudio";

export function DrawingWorkspace({ drawing }: { drawing: DrawingStudioState }) {
	if (drawing.isEditorOpen) {
		return (
			<div className="mx-auto max-w-5xl space-y-4">
				<div>
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">New Drawing</h2>
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
					<DrawingEditorControls drawing={drawing} />
					<div className="relative rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
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
							<div className="absolute inset-3 flex items-center justify-center rounded-lg bg-black/50 text-white">
								<div className="text-center">
									<div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-white" />
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
					<div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
				</div>
			);
		}

		if (drawing.selectedDrawingError || !drawing.selectedDrawing) {
			return (
				<div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
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
						className="h-56 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
					/>
				))}
			</div>
		);
	}

	if (drawing.drawingsError) {
		return (
			<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
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
			<div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
						"rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600",
					)}
				>
					<div className="relative mb-3 aspect-video w-full overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700">
						{item.paintingUrl ? (
							<img
								src={item.paintingUrl}
								alt={item.description || "Drawing"}
								className="h-full w-full object-cover"
							/>
						) : (
							<div className="flex h-full items-center justify-center">
								<Brush size={30} className="text-zinc-500 dark:text-zinc-400" />
							</div>
						)}
					</div>
					<h3 className="line-clamp-2 font-semibold text-zinc-900 dark:text-zinc-100">
						{item.description || "Untitled Drawing"}
					</h3>
					<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
						Created {new Date(item.createdAt).toLocaleDateString()}
					</p>
				</button>
			))}
		</div>
	);
}
