import { CanvasGenerationsView } from "./CanvasGenerationsView";
import { CanvasSidebarControls } from "./CanvasSidebarControls";
import { useCanvasStudio } from "./useCanvasStudio";

export function CanvasStudio() {
	const canvas = useCanvasStudio();

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
			<aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-120px)]">
				<div className="h-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
					<CanvasSidebarControls canvas={canvas} />
				</div>
			</aside>
			<CanvasGenerationsView
				canvas={canvas}
				className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700"
			/>
		</div>
	);
}
