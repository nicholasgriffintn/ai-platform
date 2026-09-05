import {
  formatTokenCount,
  formatTokenPrice,
  hasProviderReasoningOptions,
  type ModelConfigItem,
  modelSupportsVisualModality,
} from "@ngriffin_uk/polychat-schemas";
import { Gauge, WalletCards } from "lucide-react";
import { type RefObject, useLayoutEffect, useState } from "react";

import { ModelIcon } from "../ModelIcon/ModelIcon";
import { ArtificialAnalysisScorePanel } from "./ArtificialAnalysisScorePanel";
import { clampHoverPreviewTop } from "./hoverPreviewPosition";

export interface ModelHoverPreviewState {
  model: ModelConfigItem;
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  anchorTop?: number;
  frameTop?: number;
  frameBottom?: number;
}

export interface ModelHoverPreviewProps {
  preview: ModelHoverPreviewState | null;
  containerRef: RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onDismiss: () => void;
}

export function ModelHoverPreview({
  preview,
  containerRef,
  onMouseEnter,
  onDismiss,
}: ModelHoverPreviewProps) {
  const [measuredTop, setMeasuredTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    setMeasuredTop(null);
  }, [preview]);

  useLayoutEffect(() => {
    if (
      preview?.frameTop === undefined ||
      preview.frameBottom === undefined ||
      preview.anchorTop === undefined
    ) {
      return;
    }

    const element = containerRef.current;

    if (!element) {
      return;
    }

    const nextTop = clampHoverPreviewTop({
      anchorTop: preview.anchorTop,
      previewHeight: element.getBoundingClientRect().height,
      frameTop: preview.frameTop,
      frameBottom: preview.frameBottom,
    });

    setMeasuredTop((currentTop) => (currentTop === nextTop ? currentTop : nextTop));
  }, [containerRef, measuredTop, preview]);

  if (!preview) {
    return null;
  }

  const model = preview.model;
  const top = measuredTop ?? preview.top;
  const maxHeight =
    preview.frameBottom !== undefined ? preview.frameBottom - top : preview.maxHeight;

  const featureTags = Array.from(
    new Set(
      [
        model.supportsToolCalls ? "Tool Calling" : null,
        hasProviderReasoningOptions(model) ? "Reasoning" : null,
        model.supportsSearchGrounding ? "Web Grounding" : null,
        model.supportsCodeExecution ? "Code Execution" : null,
        model.supportsAudio ? "Audio" : null,
        modelSupportsVisualModality(model) ? "Vision" : null,
        ...(model.strengths || []),
      ].filter(Boolean) as string[],
    ),
  );

  return (
    <div
      ref={containerRef}
      style={{
        top,
        left: preview.left,
        width: preview.width,
        maxHeight,
      }}
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onDismiss}
      className="border-border bg-surface-elevated fixed z-[70] overflow-y-auto rounded-xl border p-3 shadow-[var(--polychat-elevated-shadow)] backdrop-blur-sm"
    >
      <div className="mb-3 rounded-lg border border-border/70 p-3">
        <div className="flex items-center gap-2">
          <ModelIcon
            url={model.avatarUrl}
            modelName={model.name || model.matchingModel}
            provider={model.provider}
            size={28}
          />
          <div className="min-w-0">
            <p className="font-semibold text-foreground whitespace-normal break-words">
              {model.name || model.matchingModel}
            </p>
            <p className="text-xs text-muted-foreground whitespace-normal break-words">
              {model.provider}
            </p>
          </div>
        </div>
        {model.description && (
          <p className="mt-2 text-xs text-muted-foreground whitespace-normal break-words">
            {model.description}
          </p>
        )}

        {featureTags.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Features
            </p>
            <div className="flex flex-wrap gap-1">
              {featureTags.map((feature) => (
                <span
                  key={`${model.id}-${feature}`}
                  className="border-border bg-selection text-foreground rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div className="rounded-lg border border-border/70 p-2.5">
          <div className="mb-1 flex items-center gap-1 text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            <span className="font-semibold">Capacity</span>
          </div>
          <div className="space-y-1">
            {model.contextWindow && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Context Window</span>
                <span className="text-right font-medium text-foreground">
                  {formatTokenCount(model.contextWindow)} tokens
                </span>
              </div>
            )}
            {model.maxTokens && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Max Output</span>
                <span className="text-right font-medium text-foreground">
                  {formatTokenCount(model.maxTokens)} tokens
                </span>
              </div>
            )}
          </div>
        </div>

        {(typeof model.costPer1kInputTokens === "number" ||
          typeof model.costPer1kOutputTokens === "number") && (
          <div className="rounded-lg border border-border/70 p-2.5">
            <div className="mb-1 flex items-center gap-1 text-muted-foreground">
              <WalletCards className="h-3.5 w-3.5" />
              <span className="font-semibold">Pricing</span>
            </div>
            <div className="space-y-1">
              {typeof model.costPer1kInputTokens === "number" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Input</span>
                  <span className="text-right font-medium text-foreground">
                    {formatTokenPrice(model.costPer1kInputTokens)}
                  </span>
                </div>
              )}
              {typeof model.costPer1kOutputTokens === "number" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Output</span>
                  <span className="text-right font-medium text-foreground">
                    {formatTokenPrice(model.costPer1kOutputTokens)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {model.artificialAnalysis ? (
          <ArtificialAnalysisScorePanel analysis={model.artificialAnalysis} />
        ) : null}
      </div>
    </div>
  );
}
