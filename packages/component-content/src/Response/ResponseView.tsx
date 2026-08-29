import type { ReactNode } from "react";

import { CustomView } from "./CustomView";
import { GeneratedAudioView } from "./GeneratedAudioView";
import { GeneratedImageView } from "./GeneratedImageView";
import { GeneratedVideoView } from "./GeneratedVideoView";
import { JsonView } from "./JsonView";
import { resolveResponsePresentation } from "./presentation";
import type { ToolInteractionHandler } from "./registry";
import {
  resolveJsonResponseData,
  resolveResponseData,
  resolveTableResponseData,
  resolveTemplateResponseData,
  resolveTextResponseData,
} from "./response-data";
import { TableView } from "./TableView";
import { TemplateView } from "./TemplateView";
import { TextView } from "./TextView";
import { ToolErrorView } from "./ToolErrorView";

export interface ResponseDisplay {
  fields?: { key: string; label: string; format?: string }[];
  template?: string;
}

export interface ResponseViewProps {
  result: Record<string, any>;
  responseType?: string;
  responseDisplay?: ResponseDisplay;
  renderer?: string;
  hasToolSchema?: boolean;
  embedded?: boolean;
  onToolInteraction?: ToolInteractionHandler;
}

const FAILURE_STATUSES = new Set(["error", "failed", "failure", "cancelled", "canceled"]);

const resolveMediaPresentation = (
  result: Record<string, any>,
  responseData: unknown,
): ReactNode | null => {
  for (const candidate of [result, responseData]) {
    const presentation = resolveResponsePresentation(candidate);

    if (presentation.kind === "image") {
      return <GeneratedImageView data={presentation.data} />;
    }

    if (presentation.kind === "audio") {
      return <GeneratedAudioView data={presentation.data} />;
    }

    if (presentation.kind === "video") {
      return (
        <GeneratedVideoView
          data={{
            title: presentation.title,
            content: presentation.content,
            videoUrl: presentation.url,
          }}
        />
      );
    }
  }

  return null;
};

const readErrorMessage = (result: Record<string, any>): string => {
  const data = result.data;
  const candidates = [
    typeof data?.error === "string" ? data.error : undefined,
    typeof data?.message === "string" ? data.message : undefined,
    typeof result.content === "string" ? result.content : undefined,
  ];

  return candidates.find((value) => value && value.trim()) || "The tool did not complete.";
};

export function ResponseView({
  result,
  responseType,
  responseDisplay,
  renderer,
  hasToolSchema = false,
  embedded = false,
  onToolInteraction,
}: ResponseViewProps) {
  const responseData = resolveResponseData(result, {
    hasAppSchema: hasToolSchema,
    responseType,
  });

  if (typeof result.status === "string" && FAILURE_STATUSES.has(result.status.toLowerCase())) {
    const hasPayload = responseData !== null && responseData !== undefined;

    return (
      <ToolErrorView
        message={readErrorMessage(result)}
        details={hasPayload ? <JsonView data={responseData} /> : undefined}
      />
    );
  }

  const customView = (
    <CustomView
      messageContent={result.content}
      data={responseData}
      toolName={typeof result.name === "string" ? result.name : undefined}
      renderer={renderer}
      embedded={embedded}
      onToolInteraction={onToolInteraction}
    />
  );

  if (!responseType) {
    return customView;
  }

  if (!renderer) {
    const media = resolveMediaPresentation(result, responseData);

    if (media) {
      return media;
    }
  }

  switch (responseType) {
    case "hidden":
      return null;

    case "table":
      return <TableView data={resolveTableResponseData(responseData, responseDisplay?.fields)} />;

    case "json":
      return <JsonView data={resolveJsonResponseData(responseData)} />;

    case "text":
      return <TextView data={resolveTextResponseData(result, responseData)} />;

    case "template":
      return (
        <TemplateView
          template={responseDisplay?.template}
          data={resolveTemplateResponseData(responseData)}
        />
      );

    default:
      return customView;
  }
}
