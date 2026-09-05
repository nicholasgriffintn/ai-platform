import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import {
  applyMarkdownEdit,
  extractMarkdownOutline,
  type MarkdownEditAction,
} from "@ngriffin_uk/polychat-library-chat/markdown-editor";
import { measureTextareaSelectionActionPosition } from "@ngriffin_uk/polychat-library-chat/textarea-selection-position";
import { getCharCount, getWordCount } from "@ngriffin_uk/polychat-utility-core";
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

import { MemoizedMarkdown } from "../markdown";
import type { ArtifactProps } from "./artifact";
import { buildArtifactDownload, createArtifactSelectionAttachment } from "./artifact-actions";

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

      if (!container) {
        return;
      }

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

      if (!editor) {
        return;
      }

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

    if (!editor) {
      return;
    }

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
    <div className="flex h-full flex-col bg-surface-elevated text-foreground">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
        <div className="flex rounded-md border border-border bg-surface-elevated p-0.5">
          <button
            type="button"
            onClick={() => setActiveView("edit")}
            className={`flex items-center gap-1.5 rounded px-2 py-1 font-medium transition-colors ${
              activeView === "edit"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye size={13} />
            Preview
          </button>
        </div>

        {activeView === "edit" && (
          <div className="flex rounded-md border border-border bg-surface-elevated p-0.5">
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

        <div className="ml-auto flex items-center gap-2 text-muted-foreground">
          <span>{documentStats.words} words</span>
          <span>{documentStats.characters} chars</span>
        </div>

        <Button size="xs" onClick={handleDownload} icon={<Download size={13} />}>
          Download
        </Button>
      </div>

      {outline.length > 0 && (
        <nav
          aria-label="Document outline"
          className="flex gap-1 overflow-x-auto border-b border-border bg-surface-elevated px-3 py-2 text-xs"
        >
          {outline.map((item) => (
            <button
              key={`${item.line}-${item.title}`}
              type="button"
              onClick={() => handleOutlineClick(item.line)}
              className="max-w-48 truncate rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
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
            className="h-full w-full resize-none bg-surface px-6 py-5 font-serif text-[15px] leading-7 text-foreground outline-none"
            spellCheck
          />
          {selection && onAddSelectionToChat && (
            <Button
              variant="outline"
              size="xs"
              onClick={handleAddSelectionToChat}
              data-selection-action="true"
              style={{ top: selection.top, left: selection.left }}
              className="absolute z-10 bg-surface shadow-lg"
              icon={<MessageSquarePlus size={13} />}
            >
              Add selection to chat
            </Button>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-surface px-6 py-5">
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
      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
    >
      {icon}
    </button>
  );
}
