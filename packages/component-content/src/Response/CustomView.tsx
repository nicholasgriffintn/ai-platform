import { BoundedMarkdown } from "./BoundedMarkdown";
import { DefinitionListView } from "./DefinitionListView";
import { GeneratedAudioView } from "./GeneratedAudioView";
import { GeneratedImageView } from "./GeneratedImageView";
import { GeneratedVideoView } from "./GeneratedVideoView";
import { JsonView } from "./JsonView";
import { resolveResponsePresentation, stripPresentationMetadata } from "./presentation";
import type { ToolInteractionHandler } from "./registry";
import { useCustomResponseView } from "./registry";
import { SourceListView } from "./SourceListView";
import { TableView } from "./TableView";

export interface CustomViewProps {
  messageContent: string;
  data: any;
  toolName?: string;
  renderer?: string;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}

export function CustomView({
  messageContent,
  data,
  toolName,
  renderer,
  embedded,
  onToolInteraction,
}: CustomViewProps) {
  const customData = data?.data ?? data;
  const registeredView = useCustomResponseView(renderer ?? toolName ?? data?.name);

  if (registeredView) {
    return registeredView({ data: customData, embedded, onToolInteraction, toolName });
  }

  const presentation = resolveResponsePresentation(stripPresentationMetadata(customData), {
    content: messageContent,
  });

  switch (presentation.kind) {
    case "image":
      return <GeneratedImageView data={presentation.data} />;

    case "audio":
      return <GeneratedAudioView data={presentation.data} />;

    case "video":
      return (
        <GeneratedVideoView
          data={{
            title: presentation.title,
            content: presentation.content,
            videoUrl: presentation.url,
          }}
        />
      );

    case "sources":
      return (
        <div className="space-y-3">
          <SourceListView sources={presentation.sources} />
          <ToolNarrative content={messageContent} />
        </div>
      );

    case "table":
      return (
        <div className="space-y-3">
          <TableView data={{ headers: presentation.headers, rows: presentation.rows }} />
          <ToolNarrative content={messageContent} />
        </div>
      );

    case "markdown":
      return <BoundedMarkdown content={presentation.content} />;

    case "definitions":
      return (
        <div className="space-y-3">
          <DefinitionListView entries={presentation.entries} />
          <ToolNarrative content={messageContent} />
        </div>
      );

    case "json":
    default:
      return (
        <div className="space-y-2">
          <ToolNarrative content={messageContent} />
          <details>
            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100">
              Raw response
            </summary>
            <div className="mt-1">
              <JsonView data={presentation.data} />
            </div>
          </details>
        </div>
      );
  }
}

function ToolNarrative({ content }: { content?: string }) {
  if (typeof content !== "string" || !content.trim()) {
    return null;
  }

  return <BoundedMarkdown content={content} />;
}
