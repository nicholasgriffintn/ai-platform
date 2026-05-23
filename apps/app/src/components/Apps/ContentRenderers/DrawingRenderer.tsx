import type { Drawing } from "~/types/drawing";
import { DrawingView } from "~/components/Canvas/Drawing/DrawingView";

interface DrawingRendererProps {
	data: Drawing;
}

export const DrawingRenderer = ({ data }: DrawingRendererProps) => {
	return <DrawingView drawing={data} />;
};
