import { File, Loader2, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useMemo } from "react";

import { ImageModal } from "~/components/ui/ImageModal";
import { MemoizedMarkdown } from "~/components/ui/Markdown";
import {
  canCombineArtifacts,
  processCustomXmlTags,
  splitContentByArtifacts,
} from "~/lib/message-utils";
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

const renderTextContent = (
  role: Message["role"],
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
  let { content, reasoning, artifacts } = formattedMessageContent(
    role,
    textContent,
  );
  content = processCustomXmlTags(content);

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

    const { textParts, identifiers } = splitContentByArtifacts(content);
    const renderedParts: ReactNode[] = [];
    const isArtifactCombinable = canCombineArtifacts(artifacts);

    for (let i = 0; i < textParts.length; i++) {
      if (textParts[i]) {
        renderedParts.push(
          <MemoizedMarkdown key={`content-${i}`}>
            {textParts[i]}
          </MemoizedMarkdown>,
        );
      }

      if (i < identifiers.length) {
        const identifier = identifiers[i];
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
              renderDocumentContent(
                attachment.url,
                attachment.name,
                undefined,
                attachment.isMarkdown,
              ),
            );
          }
          if (attachment.type === "audio") {
            renderedParts.push(
              renderAudioContent(attachment.url, attachment.name),
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
            if (!attachment.url) {
              return null;
            }
            if (attachment.type === "image") {
              return renderImageContent(attachment.url, i);
            }
            if (attachment.type === "document") {
              return renderDocumentContent(
                attachment.url,
                attachment.name,
                i,
                attachment.isMarkdown,
              );
            }
            if (attachment.type === "audio") {
              return renderAudioContent(attachment.url, attachment.name, i);
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
    <div key={`image-attachment-${index ?? 0}`}>
      <ImageModal
        src={imageUrl}
        alt="Attached content"
        thumbnailClassName="rounded-lg"
        imageClassName="rounded-lg"
      />
    </div>
  );
};

const renderDocumentContent = (
  documentUrl: string,
  documentName?: string,
  index?: number,
  isMarkdown?: boolean,
): ReactNode => {
  return (
    <div
      key={`document-attachment-${index ?? 0}`}
      className="flex flex-col items-start gap-2 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800/50 text-sm"
    >
      <div className="flex items-center gap-2">
        <File className="h-5 w-5 text-blue-500 dark:text-blue-400" />
        <span className="text-zinc-700 dark:text-zinc-300">
          {documentName || "Document"}
          {isMarkdown && (
            <span className="text-xs ml-2 italic">(converted to text)</span>
          )}
        </span>
      </div>
      {documentUrl && (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          View document
        </a>
      )}
    </div>
  );
};

const renderAudioContent = (
  audioUrl: string,
  audioName?: string,
  index?: number,
): ReactNode => {
  return (
    <div
      key={`audio-attachment-${index ?? 0}`}
      className="flex flex-col items-start gap-2 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800/50 text-sm"
    >
      <div className="flex items-center gap-2">
        <Volume2 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
        <span className="text-zinc-700 dark:text-zinc-300">
          {audioName || "Audio"}
        </span>
      </div>
      {audioUrl && (
        <audio controls className="w-full rounded-lg">
          <source src={audioUrl} type="audio/mpeg" />
          <track kind="captions" />
          Your browser does not support the audio element.
        </audio>
      )}
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

      let thinkingContent = "";

      if (Array.isArray(message.content)) {
        const thinkingBlock = message.content.find(
          (item: MessageContentType) => item.type === "thinking",
        );

        if (thinkingBlock) {
          thinkingContent = thinkingBlock.thinking || "";
        }
      }

      return (
        <>
          {typeof message.content === "string" ? (
            renderTextContent(
              message.role,
              message.content,
              message.reasoning || {
                content: thinkingContent,
                collapsed: true,
              },
              message.citations,
              message.data,
              handleArtifactOpen,
            )
          ) : Array.isArray(message.content) ? (
            <div className="space-y-4">
              {message.content.map((item: MessageContentType, i: number) => {
                if (item.type === "text" && item.text) {
                  return renderTextContent(
                    message.role,
                    item.text,
                    message.reasoning || {
                      content: thinkingContent,
                      collapsed: true,
                    },
                    message.citations,
                    message.data,
                    onArtifactOpen,
                    `text-${i}`,
                  );
                }

                if (item.type === "image_url" && item.image_url) {
                  return renderImageContent(item.image_url.url, i);
                }

                if (item.type === "audio_url" && item.audio_url) {
                  return renderAudioContent(item.audio_url.url, undefined, i);
                }

                if (item.type === "input_audio" && item.input_audio) {
                  return renderAudioContent(
                    item.input_audio.data || "",
                    undefined,
                    i,
                  );
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
                          const artifact = contentItem.artifact;
                          return {
                            identifier: artifact?.identifier || "",
                            type: artifact?.type || "",
                            language: artifact?.language || "",
                            title: artifact?.title || "",
                            content: artifact?.content || "",
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
                    attachment.isMarkdown,
                  );
                }
                if (attachment.type === "audio") {
                  return renderAudioContent(attachment.url, attachment.name, i);
                }
                return null;
              })}
            </div>
          ) : null}
        </>
      );
    }, [
      message.role,
      message.content,
      message.reasoning,
      message.data,
      message.citations,
      onArtifactOpen,
    ]);

    const asyncInvocation = (message.data as any)?.asyncInvocation;
    const isPending = message.status === "in_progress" && asyncInvocation;
    const isFailed = message.status === "failed";
    const errorMessage = message.data?.error;

    return (
      <div className="space-y-3">
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Video generation in progress...</span>
          </div>
        )}
        {isFailed && (
          <div className="text-sm text-red-500 dark:text-red-400">
            {errorMessage || "Video generation failed. Please try again."}
          </div>
        )}
        {content}
      </div>
    );
  },
);
