import type { Drawing } from "@ngriffin_uk/polychat-schemas/experiences";
import type { RefObject } from "react";

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
