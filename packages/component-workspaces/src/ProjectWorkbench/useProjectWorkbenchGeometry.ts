import {
  PROJECT_WORKBENCH_MAX_COLUMNS,
  arrangeProjectWorkbenchColumns,
  type ProjectWorkbenchLayout,
  type ProjectWorkbenchPane,
} from "@ngriffin_uk/polychat-utility-react";
import type { RefObject } from "react";

import { useWorkbenchDockResize } from "./useWorkbenchDockResize";

export const WORKBENCH_RAIL_WIDTH = 300;
const MIN_COLUMN_WIDTH = 320;
const MAX_COLUMN_WIDTH = 720;
const MIN_CONVERSATION_WIDTH = 380;
const GAP = 8;
const HANDLE_WIDTH = 8;

export function useProjectWorkbenchGeometry({
  containerRef,
  containerWidth,
  layout,
  hasContext,
  openPanes,
}: {
  containerRef: RefObject<HTMLElement | null>;
  containerWidth?: number;
  layout: ProjectWorkbenchLayout;
  hasContext: boolean;
  openPanes: readonly ProjectWorkbenchPane[];
}) {
  const availableWidth =
    containerWidth === undefined
      ? Number.POSITIVE_INFINITY
      : containerWidth - MIN_CONVERSATION_WIDTH;
  const showRail = hasContext && layout.contextOpen;
  const railFitsBesidePanels =
    availableWidth >= HANDLE_WIDTH + WORKBENCH_RAIL_WIDTH + GAP + MIN_COLUMN_WIDTH + GAP;
  const panelsHiddenByRail = showRail && !railFitsBesidePanels;
  const railSpace = showRail ? WORKBENCH_RAIL_WIDTH + GAP : 0;
  const maxColumns = Math.min(
    PROJECT_WORKBENCH_MAX_COLUMNS,
    Math.max(1, Math.floor((availableWidth - HANDLE_WIDTH - railSpace) / (MIN_COLUMN_WIDTH + GAP))),
  );
  const columns = panelsHiddenByRail ? [] : arrangeProjectWorkbenchColumns(openPanes, maxColumns);
  const columnCount = columns.length;
  const fixedWidth = HANDLE_WIDTH + railSpace + Math.max(0, columnCount - 1) * GAP + GAP;
  const resize = useWorkbenchDockResize({
    containerRef,
    containerWidth,
    width: fixedWidth + columnCount * layout.columnWidth,
    minWidth: fixedWidth + columnCount * MIN_COLUMN_WIDTH,
    maxWidth: fixedWidth + columnCount * MAX_COLUMN_WIDTH,
    minConversationWidth: MIN_CONVERSATION_WIDTH,
    onWidthChange: (width) => {
      if (columnCount > 0) {
        layout.setColumnWidth((width - fixedWidth) / columnCount);
      }
    },
  });

  return {
    showRail,
    panelsHiddenByRail,
    columnCount,
    visiblePanes: columns.flat(),
    workbenchWidth:
      columnCount > 0 ? resize.effectiveWidth : HANDLE_WIDTH + WORKBENCH_RAIL_WIDTH + GAP,
    resize: {
      min: fixedWidth + columnCount * MIN_COLUMN_WIDTH,
      max: resize.effectiveMaxWidth,
      now: resize.effectiveWidth,
      handleProps: resize.resizeHandleProps,
    },
  };
}
