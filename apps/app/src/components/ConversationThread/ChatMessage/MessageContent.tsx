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
			{content ? (
				<MemoizedMarkdown className="mt-2 text-sm">{content}</MemoizedMarkdown>
			) : (
				<div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
					No tool output
				</div>
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

			const messageParts = Array.isArray(message.parts) ? message.parts : [];
			const hasReasoningPart = messageParts.some(
				(part) => part.type === "reasoning",
			);

			if (messageParts.length > 0) {
				return (
					<div className="space-y-4">
						{message.citations && message.citations.length > 0 && (
							<CitationList citations={message.citations} />
						)}
						{message.data?.searchGrounding && (
							<SearchGroundingSection
								searchGrounding={message.data.searchGrounding}
							/>
						)}
						{message.reasoning && !hasReasoningPart && (
							<ReasoningSection reasoning={message.reasoning} />
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
						{failureHint ||
							errorMessage ||
							"Generation failed. Please try again."}
					</div>
				)}
				{content}
			</div>
		);
	},
);
