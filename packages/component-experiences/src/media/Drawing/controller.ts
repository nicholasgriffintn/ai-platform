import type { RefObject } from "react";

import type { Drawing } from "./types";

/**
 * The contract the host controller fulfils for the drawing views. Canvas element access stays a
 * ref the host owns, so the views never reach for the document themselves.
 */
export interface DrawingStudioState {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  currentColor: string;
  lineWidth: number;
  isFillMode: boolean;
  preview: string | null;
  guessResult: string | null;
  isEditorOpen: boolean;
  selectedDrawingId: string | null;
  drawingHistory: string[];
  currentHistoryIndex: number;
  drawings: Drawing[];
  selectedDrawing?: Drawing;
  isDrawingsLoading: boolean;
  drawingsError: Error | null;
  isSelectedDrawingLoading: boolean;
  selectedDrawingError: Error | null;
  isProcessing: boolean;
  setCurrentColor: (colour: string) => void;
  setLineWidth: (width: number) => void;
  setIsFillMode: (isFillMode: boolean) => void;
  setSelectedDrawingId: (drawingId: string | null) => void;
  saveToHistory: () => void;
  handleDrawingComplete: () => void;
  clearCanvas: () => void;
  undoDrawing: () => void;
  redoDrawing: () => void;
  handleGuess: () => Promise<void> | void;
  handleGenerate: () => Promise<void> | void;
  startNewDrawing: () => void;
  showDrawingList: () => void;
}
