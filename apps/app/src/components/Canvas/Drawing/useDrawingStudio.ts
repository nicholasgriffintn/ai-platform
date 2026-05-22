import { useCallback, useEffect, useRef, useState } from "react";

import {
	useFetchDrawing,
	useFetchDrawings,
	useGenerateDrawing,
	useGuessDrawing,
} from "~/hooks/useDrawings";
import { LINE_WIDTHS } from "./constants";

async function canvasToPngFile(canvas: HTMLCanvasElement): Promise<File> {
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((result) => {
			if (result) {
				resolve(result);
				return;
			}

			reject(new Error("Could not convert canvas to blob"));
		}, "image/png");
	});

	return new File([blob], "drawing.png", { type: "image/png" });
}

export function useDrawingStudio(enabled: boolean) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [currentColor, setCurrentColor] = useState("#030712");
	const [lineWidth, setLineWidth] = useState(LINE_WIDTHS[2]);
	const [isFillMode, setIsFillMode] = useState(false);
	const [preview, setPreview] = useState<string | null>(null);
	const [guessResult, setGuessResult] = useState<string | null>(null);
	const [guessedDrawingId, setGuessedDrawingId] = useState<string | null>(null);
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
	const [drawingHistory, setDrawingHistory] = useState<string[]>([]);
	const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

	const drawingsQuery = useFetchDrawings(enabled);
	const selectedDrawingQuery = useFetchDrawing(
		enabled ? selectedDrawingId || undefined : undefined,
	);
	const generateMutation = useGenerateDrawing();
	const guessMutation = useGuessDrawing();

	const saveToHistory = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const dataUrl = canvas.toDataURL("image/png");
		setPreview(dataUrl);
		setDrawingHistory((currentHistory) => {
			const nextHistory = currentHistory.slice(0, currentHistoryIndex + 1);
			nextHistory.push(dataUrl);
			setCurrentHistoryIndex(nextHistory.length - 1);
			return nextHistory;
		});
	}, [currentHistoryIndex]);

	const initialiseCanvas = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.fillStyle = "#f9fafb";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const dataUrl = canvas.toDataURL("image/png");
		setPreview(dataUrl);
		setDrawingHistory([dataUrl]);
		setCurrentHistoryIndex(0);
		setGuessResult(null);
		setGuessedDrawingId(null);
	}, []);

	useEffect(() => {
		if (isEditorOpen) {
			initialiseCanvas();
		}
	}, [initialiseCanvas, isEditorOpen]);

	const startNewDrawing = useCallback(() => {
		setSelectedDrawingId(null);
		setIsEditorOpen(true);
	}, []);

	const showDrawingList = useCallback(() => {
		setIsEditorOpen(false);
		setSelectedDrawingId(null);
	}, []);

	const handleDrawingComplete = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		setPreview(canvas.toDataURL("image/png"));
	}, []);

	const clearCanvas = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.fillStyle = "#f9fafb";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		saveToHistory();
		setGuessResult(null);
	}, [saveToHistory]);

	const undoDrawing = useCallback(() => {
		if (currentHistoryIndex <= 0) return;

		const nextIndex = currentHistoryIndex - 1;
		const previousDrawing = drawingHistory[nextIndex];
		if (!previousDrawing || !canvasRef.current) return;

		setCurrentHistoryIndex(nextIndex);
		const image = new Image();
		image.onload = () => {
			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx) return;

			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(image, 0, 0);
			setPreview(previousDrawing);
		};
		image.src = previousDrawing;
	}, [currentHistoryIndex, drawingHistory]);

	const redoDrawing = useCallback(() => {
		if (currentHistoryIndex >= drawingHistory.length - 1) return;

		const nextIndex = currentHistoryIndex + 1;
		const nextDrawing = drawingHistory[nextIndex];
		if (!nextDrawing || !canvasRef.current) return;

		setCurrentHistoryIndex(nextIndex);
		const image = new Image();
		image.onload = () => {
			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx) return;

			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			ctx.drawImage(image, 0, 0);
			setPreview(nextDrawing);
		};
		image.src = nextDrawing;
	}, [currentHistoryIndex, drawingHistory]);

	const handleGuess = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		try {
			const file = await canvasToPngFile(canvas);
			const result = await guessMutation.mutateAsync({ drawing: file });
			setGuessResult(result.content);

			if (result.completion_id) {
				setGuessedDrawingId(result.completion_id);
			}
		} catch {
			setGuessResult("Error: Could not process your drawing");
		}
	}, [guessMutation]);

	const handleGenerate = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		try {
			const file = await canvasToPngFile(canvas);
			const payload = guessedDrawingId
				? { drawing: file, drawingId: guessedDrawingId }
				: { drawing: file };
			const result = await generateMutation.mutateAsync(payload);

			if (result?.app_data_id) {
				setSelectedDrawingId(result.app_data_id);
				setIsEditorOpen(false);
			} else {
				setGuessResult("Error: Could not show your drawing");
			}
		} catch {
			setGuessResult("Error: Could not generate image from your drawing");
		}
	}, [generateMutation, guessedDrawingId]);

	return {
		canvasRef,
		currentColor,
		lineWidth,
		isFillMode,
		preview,
		guessResult,
		isEditorOpen,
		selectedDrawingId,
		drawingHistory,
		currentHistoryIndex,
		drawings: drawingsQuery.data ?? [],
		selectedDrawing: selectedDrawingQuery.data,
		isDrawingsLoading: drawingsQuery.isLoading,
		drawingsError: drawingsQuery.error,
		isSelectedDrawingLoading: selectedDrawingQuery.isLoading,
		selectedDrawingError: selectedDrawingQuery.error,
		isProcessing: generateMutation.isPending || guessMutation.isPending,
		setCurrentColor,
		setLineWidth,
		setIsFillMode,
		setSelectedDrawingId,
		saveToHistory,
		handleDrawingComplete,
		clearCanvas,
		undoDrawing,
		redoDrawing,
		handleGuess,
		handleGenerate,
		startNewDrawing,
		showDrawingList,
	};
}

export type DrawingStudioState = ReturnType<typeof useDrawingStudio>;
