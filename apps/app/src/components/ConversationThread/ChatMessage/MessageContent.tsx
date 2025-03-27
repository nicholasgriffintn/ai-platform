import { File } from "lucide-react";
import { memo, useMemo } from "react";
import type { ReactNode } from "react";

import { ImageModal } from "~/components/ui/ImageModal";
import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { formattedMessageContent } from "~/lib/messages";
import type { Message, MessageContent as MessageContentType } from "~/types";
import type { ArtifactProps } from "~/types/artifact";
import { ArtifactCallout } from "../Artifacts/ArtifactCallout";
import { CitationList } from "./CitationList";
import { ReasoningSection } from "./ReasoningSection";
import { SearchGroundingSection } from "./SearchGroundingSection";

interface MessageContentProps {
  message: Message;
  onArtifactOpen?: (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => void;
}

const canCombineArtifacts = (artifacts: ArtifactProps[]): boolean => {
  if (artifacts.length < 2) return false;

  const hasJsx = artifacts.some(
    (a) =>
      a.language?.toLowerCase().includes("jsx") ||
      a.language?.toLowerCase().includes("javascript"),
  );

  const hasCss = artifacts.some((a) =>
    a.language?.toLowerCase().includes("css"),
  );

  return hasJsx && hasCss;
};

const renderTextContent = (
  textContent: string,
  messageReasoning: Message["reasoning"] | undefined,
  messageCitations: Message["citations"] | undefined,
  messageData: Message["data"] | undefined,
  onArtifactOpen?: (
    artifact: ArtifactProps,
    combine?: boolean,
    artifacts?: ArtifactProps[],
  ) => void,
  key?: string,
): ReactNode => {
  const { content, reasoning, artifacts } =
    formattedMessageContent(textContent);

  const hasOpenReasoning = reasoning.some((item) => item.isOpen);

  const reasoningProps = messageReasoning || {
    collapsed: !hasOpenReasoning,
    content: reasoning.map((item) => item.content).join("\n"),
  };

  if (artifacts && artifacts.length > 0) {
    const artifactMap = new Map();
    for (const artifact of artifacts) {
      artifactMap.set(artifact.identifier, artifact);
    }

    const parts = content.split(/\[\[ARTIFACT:([^\]]+)\]\]/);
    const renderedParts: ReactNode[] = [];
    const isArtifactCombinable = canCombineArtifacts(artifacts);

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        if (parts[i]) {
          renderedParts.push(
            <MemoizedMarkdown key={`content-${i}`}>
              {parts[i]}
            </MemoizedMarkdown>,
          );
        }
      } else {
        const identifier = parts[i];
        const artifact = artifactMap.get(identifier);

        if (artifact) {
          renderedParts.push(
            <ArtifactCallout
              key={`artifact-${identifier}-${i}`}
              identifier={artifact.identifier}
              type={artifact.type}
              language={artifact.language}
              title={artifact.title}
              content={artifact.content}
              onOpen={onArtifactOpen}
              isCombinable={isArtifactCombinable}
              combinableCount={artifacts.length}
              artifacts={artifacts}
            />,
          );
        } else {
          console.warn(`No artifact found for identifier: ${identifier}`);
          renderedParts.push(`[[ARTIFACT:${identifier}]]`);
        }
      }
    }

    if (messageData) {
      if (messageData.attachments?.length > 0) {
        for (const attachment of messageData.attachments) {
          if (attachment.type === "image") {
            renderedParts.push(renderImageContent(attachment.url));
          }
          if (attachment.type === "document") {
            renderedParts.push(
              renderDocumentContent(attachment.url, attachment.name),
            );
          }
          if (attachment.type) {
            renderedParts.push(`[[CONTENT:${attachment.url}]]`);
          }
        }
      }
    }

    return (
      <>
        {(reasoning?.length > 0 || messageReasoning) && (
          <ReasoningSection reasoning={reasoningProps} />
        )}
        <div key={key} className="space-y-2">
          {messageCitations && messageCitations.length > 0 && (
            <CitationList citations={messageCitations} />
          )}
          {messageData?.searchGrounding && (
            <SearchGroundingSection
              searchGrounding={messageData.searchGrounding}
            />
          )}
          {renderedParts}
        </div>
      </>
    );
  }

  return (
    <>
      {(reasoning?.length > 0 || messageReasoning) && (
        <ReasoningSection reasoning={reasoningProps} />
      )}
      {messageCitations && messageCitations.length > 0 && (
        <CitationList citations={messageCitations} />
      )}
      {messageData?.searchGrounding && (
        <SearchGroundingSection searchGrounding={messageData.searchGrounding} />
      )}
      <MemoizedMarkdown key={key}>{content}</MemoizedMarkdown>
      {messageData && messageData.attachments?.length > 0 && (
        <div className="space-y-4">
          {messageData.attachments.map((attachment: any, i: number) => {
            if (attachment.type === "image") {
              return renderImageContent(attachment.url, i);
            }
            if (attachment.type === "document") {
              return renderDocumentContent(attachment.url, attachment.name, i);
            }
            return `[[CONTENT:${attachment.url}]]`;
          })}
        </div>
      )}
    </>
  );
};

const renderImageContent = (imageUrl: string, index?: number): ReactNode => {
  return (
    <div
      key={`image-attachment-${index ?? 0}`}
      className="relative overflow-hidden rounded-lg"
    >
      <ImageModal
        src={imageUrl}
        alt="Attached content"
        thumbnailClassName="rounded-lg"
      />
    </div>
  );
};

const renderDocumentContent = (
  documentUrl: string,
  documentName?: string,
  index?: number,
): ReactNode => {
  return (
    <div
      key={`document-attachment-${index ?? 0}`}
      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
        <File size={20} />
      </div>
      <div className="overflow-hidden text-sm">
        <p className="truncate font-medium">{documentName || "Document"}</p>
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          Download document
        </a>
      </div>
    </div>
  );
};

export const MessageContent = memo(
  ({ message, onArtifactOpen }: MessageContentProps) => {
    const content = useMemo(() => {
      const handleArtifactOpen = (
        artifact: ArtifactProps,
        combine?: boolean,
        artifacts?: ArtifactProps[],
      ) => {
        if (combine) {
          onArtifactOpen?.(artifact, true, artifacts);
        } else {
          onArtifactOpen?.(artifact, false);
        }
      };

      return (
        <>
          {typeof message.content === "string" ? (
            renderTextContent(
              message.content,
              message.reasoning,
              message.citations,
              message.data,
              handleArtifactOpen,
            )
          ) : Array.isArray(message.content) ? (
            <div className="space-y-4">
              {message.content.map((item: MessageContentType, i: number) => {
                if (item.type === "text" && item.text) {
                  return renderTextContent(
                    item.text,
                    message.reasoning,
                    message.citations,
                    message.data,
                    onArtifactOpen,
                    `text-${i}`,
                  );
                }

                if (item.type === "image_url" && item.image_url) {
                  return renderImageContent(item.image_url.url, i);
                }

                if (item.type === "artifact" && item.artifact) {
                  const artifacts: ArtifactProps[] = Array.isArray(
                    message.content,
                  )
                    ? message.content
                        .filter(
                          (contentItem) =>
                            contentItem.type === "artifact" &&
                            contentItem.artifact,
                        )
                        .map((contentItem) => {
                          const artifact = (contentItem as any).artifact;
                          return {
                            identifier: artifact.identifier,
                            type: artifact.type,
                            language: artifact.language,
                            title: artifact.title,
                            content: artifact.content,
                          };
                        })
                    : [];

                  const isArtifactCombinable = canCombineArtifacts(artifacts);

                  return (
                    <ArtifactCallout
                      key={`artifact-item-${item.artifact.identifier}`}
                      identifier={item.artifact.identifier}
                      type={item.artifact.type}
                      language={item.artifact.language}
                      title={item.artifact.title}
                      content={item.artifact.content}
                      onOpen={handleArtifactOpen}
                      isCombinable={isArtifactCombinable}
                      combinableCount={artifacts.length}
                    />
                  );
                }

                return null;
              })}
            </div>
          ) : message.data &&
            "attachments" in message.data &&
            message.data.attachments ? (
            <div className="space-y-4">
              {message.data.attachments.map((attachment: any, i: number) => {
                if (attachment.type === "image") {
                  return renderImageContent(attachment.url, i);
                }
                if (attachment.type === "document") {
                  return renderDocumentContent(
                    attachment.url,
                    attachment.name,
                    i,
                  );
                }
                return null;
              })}
            </div>
          ) : null}
        </>
      );
    }, [
      message.content,
      message.reasoning,
      message.data,
      message.citations,
      onArtifactOpen,
    ]);

    return content;
  },
);
