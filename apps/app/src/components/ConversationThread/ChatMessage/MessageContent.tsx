import { File, FileText, Loader2, Volume2 } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { memo, useMemo } from "react";

import { ImageModal } from "~/components/ui/ImageModal";
import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import { isInlinePreviewArtifact } from "~/lib/artifacts";
import {
	canCombineArtifacts,
	processCustomXmlTags,
	splitContentByArtifacts,
} from "~/lib/message-utils";
import { formattedMessageContent } from "~/lib/messages";
import { resolveRenderableToolResult } from "~/lib/tool-results";
import type { Message, MessageContent as MessageContentType } from "~/types";
import type { ArtifactProps } from "~/types/artifact";
import { ArtifactCallout } from "../Artifacts/ArtifactCallout";
import { ArtifactInlinePreview } from "../Artifacts/ArtifactInlinePreview";
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
	let { content, reasoning, artifacts } = formattedMessageContent(role, textContent);
	content = processCustomXmlTags(content);

	const hasOpenReasoning = reasoning.some((item) => item.isOpen);

	const reasoningProps = messageReasoning || {
		collapsed: !hasOpenReasoning,
		content: reasoning.map((item) => item.content).join("\n"),
	};

	if (artifacts && artifacts.length > 0) {
		const artifactMap = new Map<string, ArtifactProps>();
		for (const artifact of artifacts) {
			artifactMap.set(artifact.identifier, artifact);
		}

		const { textParts, identifiers } = splitContentByArtifacts(content);
		const renderedParts: ReactNode[] = [];
		const isArtifactCombinable = canCombineArtifacts(artifacts);

		for (let i = 0; i < textParts.length; i++) {
			if (textParts[i]) {
				renderedParts.push(
					<MemoizedMarkdown key={`content-${i}`}>{textParts[i]}</MemoizedMarkdown>,
				);
			}

			if (i < identifiers.length) {
				const identifier = identifiers[i];
				const artifact = artifactMap.get(identifier);

				if (artifact) {
					renderedParts.push(
						isInlinePreviewArtifact(artifact) ? (
							<ArtifactInlinePreview
								key={`artifact-${identifier}-${i}`}
								artifact={artifact}
								artifacts={artifacts}
							/>
						) : (
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
							/>
						),
					);
				} else {
					console.warn(`No artifact found for identifier: ${identifier}`);
					renderedParts.push(`[[ARTIFACT:${identifier}]]`);
				}
			}
		}

		if (messageData?.attachments?.length) {
			for (const [attachmentIndex, attachment] of messageData.attachments.entries()) {
				if (attachment.type === "image") {
					renderedParts.push(renderImageContent(attachment.url, attachmentIndex));
				} else if (attachment.type === "document") {
					renderedParts.push(
						renderDocumentContent(
							attachment.url,
							attachment.name,
							attachmentIndex,
							attachment.isMarkdown,
						),
					);
				} else if (attachment.type === "audio") {
					renderedParts.push(renderAudioContent(attachment.url, attachment.name, attachmentIndex));
				} else {
					renderedParts.push(
						<Fragment key={`content-fallback-${attachmentIndex}`}>
							{`[[CONTENT:${attachment.url}]]`}
						</Fragment>,
					);
				}
			}
		}

		return (
			<Fragment key={key}>
				{(reasoning?.length > 0 || messageReasoning) && (
					<ReasoningSection reasoning={reasoningProps} />
				)}
				<div className="space-y-2">
					{messageCitations && messageCitations.length > 0 && (
						<CitationList citations={messageCitations} />
					)}
					{messageData?.searchGrounding && (
						<SearchGroundingSection searchGrounding={messageData.searchGrounding} />
					)}
					{renderedParts}
				</div>
			</Fragment>
		);
	}

	return (
		<Fragment key={key}>
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
					{messageData.attachments.map((attachment, i) => {
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
						return (
							<Fragment key={`content-fallback-${i}`}>{`[[CONTENT:${attachment.url}]]`}</Fragment>
						);
					})}
				</div>
			)}
		</Fragment>
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
				crossOrigin="use-credentials"
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
					{isMarkdown && <span className="text-xs ml-2 italic">(converted to text)</span>}
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

const renderArtifactSelectionContent = (
	selection: NonNullable<MessageContentType["artifact_selection"]>,
	index?: number,
): ReactNode => {
	const title = selection.artifact.title || selection.artifact.identifier;
	const byteCount = new Blob([selection.selectedText]).size;

	return (
		<div
			key={`artifact-selection-${index ?? 0}`}
			className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white/80 p-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70"
		>
			<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
				<FileText className="h-4 w-4" aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
					selection from {title}
				</div>
				<div className="text-xs text-zinc-500 dark:text-zinc-400">Text · {byteCount} B</div>
			</div>
		</div>
	);
};

const renderAudioContent = (audioUrl: string, audioName?: string, index?: number): ReactNode => {
	return (
		<div
			key={`audio-attachment-${index ?? 0}`}
			className="flex flex-col items-start gap-2 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-800/50 text-sm"
		>
			<div className="flex items-center gap-2">
				<Volume2 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
				<span className="text-zinc-700 dark:text-zinc-300">{audioName || "Audio"}</span>
			</div>
			{audioUrl && (
				<audio controls crossOrigin="use-credentials" className="w-full rounded-lg">
					<source src={audioUrl} type="audio/mpeg" />
					<track kind="captions" />
					Your browser does not support the audio element.
				</audio>
			)}
		</div>
	);
};

const renderToolUsePart = (
	part: Extract<NonNullable<Message["parts"]>[number], { type: "tool_use" }>,
	index: number,
): ReactNode => {
	const formattedInput =
		typeof part.input === "string"
			? part.input
			: part.input
				? JSON.stringify(part.input, null, 2)
				: "{}";

	return (
		<div
			key={`tool-use-${part.toolCallId || part.name}-${index}`}
			className="rounded border border-amber-200/60 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
		>
			<div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
				Tool call: {part.name}
			</div>
			<pre className="mt-2 overflow-x-auto text-xs text-zinc-700 dark:text-zinc-300">
				{formattedInput}
			</pre>
		</div>
	);
};

const renderToolResultPart = (
	part: Extract<NonNullable<Message["parts"]>[number], { type: "tool_result" }>,
	index: number,
): ReactNode => {
	const renderableResult = resolveRenderableToolResult(part);
	const content =
		typeof part.content === "string"
			? part.content
			: part.content
				? JSON.stringify(part.content, null, 2)
				: "";

	return (
		<div
			key={`tool-result-${part.toolCallId || part.name || "tool"}-${index}`}
			className="rounded border border-blue-200/60 bg-blue-50/80 p-3 dark:border-blue-900/50 dark:bg-blue-950/20"
		>
			<div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
				Tool result{part.name ? `: ${part.name}` : ""}
				{part.status ? ` (${part.status})` : ""}
			</div>
			{renderableResult ? (
				<ResponseRenderer result={renderableResult.result} className="mt-3" embedded />
			) : content ? (
				<MemoizedMarkdown className="mt-2 text-sm">{content}</MemoizedMarkdown>
			) : (
				<div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">No tool output</div>
			)}
		</div>
	);
};

const renderSnapshotPart = (
	part: Extract<NonNullable<Message["parts"]>[number], { type: "snapshot" }>,
	index: number,
): ReactNode => {
	return (
		<div
			key={`snapshot-${index}`}
			className="rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40"
		>
			{part.title ? (
				<div className="mb-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
					{part.title}
				</div>
			) : null}
			<MemoizedMarkdown className="text-sm">{part.summary}</MemoizedMarkdown>
		</div>
	);
};

export const MessageContent = memo(({ message, onArtifactOpen }: MessageContentProps) => {
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

		const messageParts = Array.isArray(message.parts) ? message.parts : [];
		const hasReasoningPart = messageParts.some((part) => part.type === "reasoning");
		const hasTextPart = messageParts.some(
			(part) => part.type === "text" && part.text.trim().length > 0,
		);
		const shouldRenderContentFallback =
			!hasTextPart && typeof message.content === "string" && message.content.trim().length > 0;

		if (messageParts.length > 0) {
			return (
				<div className="space-y-4">
					{message.citations && message.citations.length > 0 && (
						<CitationList citations={message.citations} />
					)}
					{message.data?.searchGrounding && (
						<SearchGroundingSection searchGrounding={message.data.searchGrounding} />
					)}
					{message.reasoning && !hasReasoningPart && (
						<ReasoningSection reasoning={message.reasoning} />
					)}
					{shouldRenderContentFallback &&
						renderTextContent(
							message.role,
							message.content as string,
							undefined,
							undefined,
							undefined,
							handleArtifactOpen,
							"content-fallback",
						)}
					{messageParts.map((part, index) => {
						if (part.type === "text") {
							return renderTextContent(
								message.role,
								part.text,
								undefined,
								undefined,
								undefined,
								handleArtifactOpen,
								`part-text-${index}`,
							);
						}

						if (part.type === "reasoning") {
							return (
								<ReasoningSection
									key={`part-reasoning-${index}`}
									reasoning={{
										content: part.text,
										collapsed: part.collapsed ?? true,
									}}
								/>
							);
						}

						if (part.type === "tool_use") {
							return renderToolUsePart(part, index);
						}

						if (part.type === "tool_result") {
							return renderToolResultPart(part, index);
						}

						if (part.type === "snapshot") {
							return renderSnapshotPart(part, index);
						}

						if (part.type === "file") {
							if (part.mimeType?.startsWith("image/") && part.url) {
								return renderImageContent(part.url, index);
							}
							if (part.mimeType?.startsWith("audio/") && part.url) {
								return renderAudioContent(part.url, part.name, index);
							}
							return renderDocumentContent(
								part.url || "",
								part.name,
								index,
								part.mimeType === "text/markdown",
							);
						}

						return null;
					})}
				</div>
			);
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
								return renderAudioContent(item.input_audio.data || "", undefined, i);
							}

							if (item.type === "artifact" && item.artifact) {
								const artifacts: ArtifactProps[] = Array.isArray(message.content)
									? message.content
											.filter(
												(contentItem) => contentItem.type === "artifact" && contentItem.artifact,
											)
											.map((contentItem) => {
												const artifact = contentItem.artifact;
												return {
													identifier: artifact?.identifier || "",
													type: artifact?.type || "",
													language: artifact?.language || "",
													title: artifact?.title || "",
													display: artifact?.display,
													content: artifact?.content || "",
												};
											})
									: [];

								const isArtifactCombinable = canCombineArtifacts(artifacts);

								const artifact: ArtifactProps = {
									identifier: item.artifact.identifier,
									type: item.artifact.type,
									language: item.artifact.language,
									title: item.artifact.title,
									display: item.artifact.display,
									content: item.artifact.content,
								};

								if (isInlinePreviewArtifact(artifact)) {
									return (
										<ArtifactInlinePreview
											key={`artifact-item-${item.artifact.identifier}`}
											artifact={artifact}
											artifacts={artifacts}
										/>
									);
								}

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

							if (item.type === "artifact_selection" && item.artifact_selection) {
								return renderArtifactSelectionContent(item.artifact_selection, i);
							}

							return null;
						})}
					</div>
				) : message.data && "attachments" in message.data && message.data.attachments ? (
					<div className="space-y-4">
						{message.data.attachments.map((attachment, i) => {
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
		message.parts,
		message.reasoning,
		message.data,
		message.citations,
		onArtifactOpen,
	]);

	const asyncInvocation = message.data?.asyncInvocation;
	const isPending = message.status === "in_progress" && asyncInvocation;
	const isFailed = message.status === "failed";
	const errorMessage = message.data?.error;
	const progressHint =
		asyncInvocation?.contentHints?.progress?.[0]?.text ??
		asyncInvocation?.contentHints?.placeholder?.[0]?.text;
	const failureHint = asyncInvocation?.contentHints?.failure?.[0]?.text;

	return (
		<div className="space-y-3">
			{isPending && (
				<div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span>{progressHint || "Content generation in progress..."}</span>
				</div>
			)}
			{isFailed && (
				<div className="text-sm text-red-500 dark:text-red-400">
					{failureHint || errorMessage || "Generation failed. Please try again."}
				</div>
			)}
			{content}
		</div>
	);
});
