import type { Drawing } from "~/types/drawing";
import { DrawingView } from "../Drawings/View";

interface DrawingRendererProps {
	data: Drawing;
}

export const DrawingRenderer = ({ data }: DrawingRendererProps) => {
	return <DrawingView drawing={data} />;
};
