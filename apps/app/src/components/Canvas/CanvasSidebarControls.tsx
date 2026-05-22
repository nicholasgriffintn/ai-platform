import { Brush, Film, Image } from "lucide-react";

import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";
import { DrawingSidebarControls } from "./Drawing/DrawingSidebarControls";
import type { CanvasStudioState } from "./useCanvasStudio";

export function CanvasSidebarControls({ canvas }: { canvas: CanvasStudioState }) {
	return (
		<div className="space-y-4 p-2 pb-4">
			<div className="grid grid-cols-[repeat(3,minmax(0,1fr))] rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
				<button
					type="button"
					aria-label="Image generation"
					title="Image generation"
					onClick={() => canvas.handleModeChange("image")}
					className={cn(
						"box-border flex h-10 w-full min-w-0 items-center justify-center rounded-lg border border-transparent p-2 transition",
						canvas.mode === "image"
							? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
							: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
							? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
							: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
							? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
							: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
					)}
				>
					<Brush className="h-5 w-5" />
				</button>
			</div>

			{canvas.mode === "drawing" && <DrawingSidebarControls drawing={canvas.drawing} />}

			{canvas.mode !== "drawing" && (
				<>
					<div className="space-y-2">
						<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
							Prompt
						</label>
						<textarea
							value={canvas.prompt}
							onChange={(event) => canvas.setPrompt(event.target.value)}
							rows={4}
							className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
							placeholder="Describe what to generate..."
						/>
					</div>

					<div className="space-y-2">
						<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
							Negative Prompt
						</label>
						<input
							value={canvas.negativePrompt}
							onChange={(event) => canvas.setNegativePrompt(event.target.value)}
							className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
							placeholder="Optional"
						/>
					</div>

					<div className="space-y-2">
						<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
							Reference Images
						</label>
						<textarea
							value={canvas.referenceInput}
							onChange={(event) => canvas.setReferenceInput(event.target.value)}
							rows={3}
							className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
							placeholder="One URL per line"
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
								Models
							</label>
							<span className="text-xs text-zinc-500 dark:text-zinc-400">
								{canvas.selectedModelIds.length} selected
							</span>
						</div>
						<input
							value={canvas.modelSearch}
							onChange={(event) => canvas.setModelSearch(event.target.value)}
							className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
							placeholder="Search models"
						/>

						<div className="max-h-60 space-y-2 overflow-auto rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
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
												? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
												: "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
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
								<p className="px-2 py-3 text-xs text-zinc-500 dark:text-zinc-400">
									No models match this filter.
								</p>
							)}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-2">
						<div className="space-y-1">
							<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
								Aspect
							</label>
							<select
								value={canvas.aspectRatio}
								onChange={(event) => canvas.setAspectRatio(event.target.value)}
								className="w-full rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
							>
								<option value="">Default</option>
								{canvas.aspectRatioOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-1">
							<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
								Resolution
							</label>
							<select
								value={canvas.resolution}
								onChange={(event) => canvas.setResolution(event.target.value)}
								className="w-full rounded-xl border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
							>
								<option value="">Default</option>
								{canvas.resolutionOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>
					</div>

					{canvas.mode === "video" && (
						<div className="space-y-2">
							<div className="space-y-1">
								<label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
									Duration (sec)
								</label>
								<input
									type="number"
									min={1}
									max={20}
									value={canvas.durationSeconds}
									onChange={(event) => canvas.setDurationSeconds(event.target.value)}
									className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
									placeholder="Optional"
								/>
							</div>
							<label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
								<input
									type="checkbox"
									checked={canvas.generateAudio}
									onChange={(event) => canvas.setGenerateAudio(event.target.checked)}
								/>
								Generate audio
							</label>
						</div>
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

					{canvas.error && (
						<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
							{canvas.error instanceof Error
								? canvas.error.message
								: "Could not load Canvas resources."}
						</p>
					)}
				</>
			)}
		</div>
	);
}
