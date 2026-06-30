import {
	Bold,
	Download,
	Eye,
	Heading2,
	Italic,
	List,
	MessageSquarePlus,
	Pencil,
	Quote,
} from "lucide-react";
import {
	type ReactNode,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { buildArtifactDownload, createArtifactSelectionAttachment } from "~/lib/artifacts";
import type { AttachmentData } from "~/lib/chat/attachments";
import {
	applyMarkdownEdit,
	extractMarkdownOutline,
	type MarkdownEditAction,
} from "~/lib/markdown-editor";
import { getCharCount, getWordCount } from "~/lib/text-utils";
import { measureTextareaSelectionActionPosition } from "~/lib/textarea-selection-position";
import type { ArtifactProps } from "~/types/artifact";

interface ArtifactDocumentEditorProps {
	artifact: ArtifactProps;
	onAddSelectionToChat?: (attachment: AttachmentData) => void;
}

export const ArtifactDocumentEditor = ({
	artifact,
	onAddSelectionToChat,
}: ArtifactDocumentEditorProps) => {
	const editorContainerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<HTMLTextAreaElement>(null);
	const [content, setContent] = useState(artifact.content);
	const [selection, setSelection] = useState<{
		text: string;
		start: number;
		end: number;
		top: number;
		left: number;
	} | null>(null);
	const [activeView, setActiveView] = useState<"edit" | "preview">("edit");
	const outline = useMemo(() => extractMarkdownOutline(content), [content]);

	useEffect(() => {
		setContent(artifact.content);
		setSelection(null);
		setActiveView("edit");
	}, [artifact.content, artifact.identifier]);

	const documentStats = useMemo(
		() => ({
			words: getWordCount(content),
			characters: getCharCount(content),
		}),
		[content],
	);

	const handleSelectionChange = useCallback(
		(event: SyntheticEvent<HTMLTextAreaElement>) => {
			const target = event.currentTarget;
			const selectedText = content.slice(target.selectionStart, target.selectionEnd).trim();

			if (!selectedText) {
				setSelection(null);
				return;
			}

			const container = editorContainerRef.current;
			if (!container) return;

			const position = measureTextareaSelectionActionPosition({
				textarea: target,
				container,
				content,
				selectionStart: target.selectionStart,
				selectionEnd: target.selectionEnd,
			});

			setSelection({
				text: selectedText,
				start: target.selectionStart,
				end: target.selectionEnd,
				top: position.top,
				left: position.left,
			});
		},
		[content],
	);

	const handleAddSelectionToChat = useCallback(() => {
		if (!selection || !onAddSelectionToChat) {
			return;
		}

		onAddSelectionToChat(
			createArtifactSelectionAttachment({
				artifact,
				selectedText: selection.text,
				selectionStart: selection.start,
				selectionEnd: selection.end,
			}),
		);
		setSelection(null);
	}, [artifact, onAddSelectionToChat, selection]);

	const handleApplyMarkdownEdit = useCallback(
		(action: MarkdownEditAction) => {
			const editor = editorRef.current;
			if (!editor) return;

			const edit = applyMarkdownEdit(content, editor.selectionStart, editor.selectionEnd, action);
			setContent(edit.content);
			setSelection(null);

			window.requestAnimationFrame(() => {
				editor.focus();
				editor.setSelectionRange(edit.selectionStart, edit.selectionEnd);
			});
		},
		[content],
	);

	const handleOutlineClick = useCallback((line: number) => {
		const editor = editorRef.current;
		if (!editor) return;

		setActiveView("edit");
		editor.focus();
		editor.scrollTop = Math.max((line - 1) * 28, 0);
	}, []);

	const handleDownload = useCallback(() => {
		const download = buildArtifactDownload(artifact, content);
		const blob = new Blob([download.content], { type: download.mimeType });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = download.filename;
		link.click();
		URL.revokeObjectURL(url);
	}, [artifact, content]);

	return (
		<div className="flex h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
			<div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
				<div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
					<button
						type="button"
						onClick={() => setActiveView("edit")}
						className={`flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors ${
							activeView === "edit"
								? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
								: "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
						}`}
					>
						<Pencil size={13} />
						Edit
					</button>
					<button
						type="button"
						onClick={() => setActiveView("preview")}
						className={`flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors ${
							activeView === "preview"
								? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
								: "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
						}`}
					>
						<Eye size={13} />
						Preview
					</button>
				</div>

				{activeView === "edit" && (
					<div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
						<MarkdownToolbarButton
							label="Bold"
							action="bold"
							onApply={handleApplyMarkdownEdit}
							icon={<Bold size={13} />}
						/>
						<MarkdownToolbarButton
							label="Italic"
							action="italic"
							onApply={handleApplyMarkdownEdit}
							icon={<Italic size={13} />}
						/>
						<MarkdownToolbarButton
							label="Heading"
							action="heading"
							onApply={handleApplyMarkdownEdit}
							icon={<Heading2 size={13} />}
						/>
						<MarkdownToolbarButton
							label="Bulleted list"
							action="bullet-list"
							onApply={handleApplyMarkdownEdit}
							icon={<List size={13} />}
						/>
						<MarkdownToolbarButton
							label="Quote"
							action="quote"
							onApply={handleApplyMarkdownEdit}
							icon={<Quote size={13} />}
						/>
					</div>
				)}

				<div className="ml-auto flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
					<span>{documentStats.words} words</span>
					<span>{documentStats.characters} chars</span>
				</div>

				<button
					type="button"
					onClick={handleDownload}
					className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-1 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
				>
					<Download size={13} />
					Download
				</button>
			</div>

			{outline.length > 0 && (
				<nav
					aria-label="Document outline"
					className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
				>
					{outline.map((item) => (
						<button
							key={`${item.line}-${item.title}`}
							type="button"
							onClick={() => handleOutlineClick(item.line)}
							className="max-w-48 truncate rounded px-2 py-1 text-zinc-600 transition-colors hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
							style={{ marginLeft: `${Math.max(item.level - 1, 0) * 10}px` }}
						>
							{item.title}
						</button>
					))}
				</nav>
			)}

			{activeView === "edit" ? (
				<div ref={editorContainerRef} className="relative min-h-0 flex-1">
					<textarea
						ref={editorRef}
						aria-label="Document content"
						value={content}
						onChange={(event) => setContent(event.currentTarget.value)}
						onSelect={handleSelectionChange}
						className="h-full w-full resize-none bg-white px-6 py-5 font-serif text-[15px] leading-7 text-zinc-900 outline-none dark:bg-zinc-900 dark:text-zinc-100"
						spellCheck={true}
					/>
					{selection && onAddSelectionToChat && (
						<button
							type="button"
							onClick={handleAddSelectionToChat}
							data-selection-action="true"
							style={{ top: selection.top, left: selection.left }}
							className="absolute z-10 flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 shadow-lg transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
						>
							<MessageSquarePlus size={13} />
							Add selection to chat
						</button>
					)}
				</div>
			) : (
				<div className="min-h-0 flex-1 overflow-auto bg-white px-6 py-5 dark:bg-zinc-900">
					<MemoizedMarkdown className="max-w-none">{content}</MemoizedMarkdown>
				</div>
			)}
		</div>
	);
};

interface MarkdownToolbarButtonProps {
	label: string;
	action: MarkdownEditAction;
	icon: ReactNode;
	onApply: (action: MarkdownEditAction) => void;
}

function MarkdownToolbarButton({ label, action, icon, onApply }: MarkdownToolbarButtonProps) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onApply(action)}
			className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
		>
			{icon}
		</button>
	);
}
