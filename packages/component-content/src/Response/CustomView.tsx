import { MemoizedMarkdown } from "../markdown";
import { DefinitionListView } from "./DefinitionListView";
import { GeneratedAudioView } from "./GeneratedAudioView";
import { GeneratedImageView } from "./GeneratedImageView";
import { GeneratedVideoView } from "./GeneratedVideoView";
import { JsonView } from "./JsonView";
import { resolveResponsePresentation } from "./presentation";
import type { ToolInteractionHandler } from "./registry";
import { useCustomResponseView } from "./registry";
import { SourceListView } from "./SourceListView";
import { TableView } from "./TableView";

export interface CustomViewProps {
  messageContent: string;
  data: any;
  toolName?: string;
  /** Explicit view id declared by the tool. Preferred over the tool name, which MCP tools mint. */
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

  const presentation = resolveResponsePresentation(customData, { content: messageContent });

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
      return <MemoizedMarkdown className="max-w-none">{presentation.content}</MemoizedMarkdown>;

    case "definitions":
      return (
        <div className="space-y-3">
          <DefinitionListView entries={presentation.entries} />
          <ToolNarrative content={messageContent} />
        </div>
      );

    case "json":
    default:
      /**
       * The tool's own prose leads; the payload stays reachable but folded, so an unrecognised
       * result reads as a result rather than as a debug dump.
       */
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

  return <MemoizedMarkdown className="max-w-none">{content}</MemoizedMarkdown>;
}
