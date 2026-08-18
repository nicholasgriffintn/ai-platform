import "../styles.css";

export type MediaPreviewModel =
  | { type: "image"; url: string; alt: string }
  | { type: "video"; url: string; title: string }
  | { type: "audio"; url: string; title: string };

export function MediaPreview({
  preview,
  renderImage,
}: {
  preview: MediaPreviewModel;
  renderImage?: (preview: Extract<MediaPreviewModel, { type: "image" }>) => React.ReactNode;
}) {
  if (preview.type === "image")
    return (
      <div className="polychat-experience-media-preview">
        {renderImage ? (
          renderImage(preview)
        ) : (
          <img src={preview.url} alt={preview.alt} loading="lazy" decoding="async" />
        )}
      </div>
    );
  if (preview.type === "video")
    return (
      <div className="polychat-experience-media-preview">
        <video controls aria-label={preview.title}>
          <source src={preview.url} type="video/mp4" />
        </video>
      </div>
    );
  return (
    <div className="polychat-experience-media-preview">
      <audio controls aria-label={preview.title}>
        <source src={preview.url} />
      </audio>
    </div>
  );
}

export * from "./Canvas/CanvasGenerationsView";
export * from "./Canvas/CanvasModelOptionControls";
export * from "./Canvas/CanvasSidebarControls";
export * from "./Canvas/controller";
export * from "./Canvas/GenerationCard";
export * from "./Canvas/types";
export * from "./Canvas/utils";
export * from "./Drawing/constants";
export * from "./Drawing/controller";
export * from "./Drawing/ColorPicker";
export * from "./Drawing/DrawingCanvas";
export * from "./Drawing/DrawingEditorControls";
export * from "./Drawing/DrawingSidebarControls";
export * from "./Drawing/DrawingView";
export * from "./Drawing/DrawingWorkspace";
export * from "./Drawing/LineWidthPicker";
export * from "./Drawing/ToolPicker";
export * from "./Drawing/types";
export * from "./ReplicateModelForm";
export * from "./ReplicatePredictionView";
export * from "./ReplicateModelFilters";
export * from "./ReplicatePredictionList";
export * from "./ReplicateModelDetailView";
export * from "./ReplicateModelCategoryGrid";
export * from "./ReplicateLoadState";
