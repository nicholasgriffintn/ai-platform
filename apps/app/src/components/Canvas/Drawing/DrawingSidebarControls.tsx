import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "~/components/ui";
import type { DrawingStudioState } from "./useDrawingStudio";

export function DrawingSidebarControls({ drawing }: { drawing: DrawingStudioState }) {
	return (
		<div className="space-y-4">
			<Button
				variant="primary"
				fullWidth
				icon={<Plus size={16} />}
				onClick={drawing.startNewDrawing}
			>
				New Drawing
			</Button>

			{drawing.isEditorOpen ? (
				<Button
					variant="secondary"
					fullWidth
					icon={<ArrowLeft size={16} />}
					onClick={drawing.showDrawingList}
				>
					Past Drawings
				</Button>
			) : null}
		</div>
	);
}
