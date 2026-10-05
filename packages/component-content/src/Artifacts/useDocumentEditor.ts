import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import {
  applyMarkdownEdit,
  extractMarkdownOutline,
  type MarkdownEditAction,
} from "@ngriffin_uk/polychat-library-chat/markdown-editor";
import { measureTextareaSelectionActionPosition } from "@ngriffin_uk/polychat-library-chat/textarea-selection-position";
import {
  createTextAnchor,
  getCharCount,
  getErrorMessage,
  getWordCount,
  type TextAnchor,
} from "@ngriffin_uk/polychat-utility-core";
import { downloadTextFile } from "@ngriffin_uk/polychat-utility-react";
import { type SyntheticEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ArtifactProps } from "./artifact";
import { buildArtifactDownload, createArtifactSelectionAttachment } from "./artifact-actions";

export interface DocumentEditorOptions {
  artifact: ArtifactProps;
  sourceRevision?: number;
  onAddSelectionToChat?: (attachment: AttachmentData) => void;
  onSave?: (content: string, expectedRevision: number) => Promise<void>;
  onDownload?: () => void;
  onRewrite?: () => Promise<{ body: string; sourceRevision: number }>;
}

interface EditorSelection {
  text: string;
  anchor: TextAnchor;
  top: number;
  left: number;
}

export function useDocumentEditor({
  artifact,
  sourceRevision,
  onAddSelectionToChat,
  onSave,
  onDownload,
  onRewrite,
}: DocumentEditorOptions) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(artifact.content);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const [activeView, setActiveView] = useState<"edit" | "preview">("edit");
  const [base, setBase] = useState({ content: artifact.content, revision: sourceRevision });
  const [incoming, setIncoming] = useState({
    identifier: artifact.identifier,
    content: artifact.content,
    revision: sourceRevision,
  });
  const liveDraft = useRef({ identifier: artifact.identifier, content, revision: base.revision });

  useLayoutEffect(() => {
    liveDraft.current = { identifier: artifact.identifier, content, revision: base.revision };
  }, [artifact.identifier, content, base.revision]);

  if (
    incoming.identifier !== artifact.identifier ||
    incoming.content !== artifact.content ||
    incoming.revision !== sourceRevision
  ) {
    setIncoming({
      identifier: artifact.identifier,
      content: artifact.content,
      revision: sourceRevision,
    });

    if (incoming.identifier !== artifact.identifier || content === base.content) {
      setBase({ content: artifact.content, revision: sourceRevision });
      setContent(artifact.content);
      setSelection(null);
      setActiveView("edit");
    }
  }

  const isDirty = content !== base.content;
  const remoteChanged = artifact.content !== base.content || sourceRevision !== base.revision;
  const outline = useMemo(() => extractMarkdownOutline(content), [content]);
  const documentStats = useMemo(
    () => ({ words: getWordCount(content), characters: getCharCount(content) }),
    [content],
  );

  function handleContentChange(value: string) {
    setContent(value);
    setSelection(null);
  }

  function resetToLatest() {
    setBase({ content: artifact.content, revision: sourceRevision });
    setContent(artifact.content);
    setSelection(null);
  }

  function handleSelectionChange(event: SyntheticEvent<HTMLTextAreaElement>) {
    const target = event.currentTarget;
    const text = content.slice(target.selectionStart, target.selectionEnd);
    const container = editorContainerRef.current;

    if (!text.trim() || !container) {
      setSelection(null);

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
      text,
      anchor: createTextAnchor(content, target.selectionStart, target.selectionEnd),
      ...position,
    });
  }

  function handleAddSelectionToChat() {
    if (selection && onAddSelectionToChat) {
      onAddSelectionToChat(
        createArtifactSelectionAttachment({ artifact, selectedText: selection.text }),
      );
      setSelection(null);
    }
  }

  function handleApplyMarkdownEdit(action: MarkdownEditAction) {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const edit = applyMarkdownEdit(content, editor.selectionStart, editor.selectionEnd, action);

    handleContentChange(edit.content);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  function handleOutlineClick(line: number) {
    const editor = editorRef.current;

    if (editor) {
      setActiveView("edit");
      editor.focus();
      editor.scrollTop = Math.max((line - 1) * 28, 0);
    }
  }

  function handleDownload() {
    if (onDownload && !isDirty) {
      onDownload();

      return;
    }

    const download = buildArtifactDownload(artifact, content);

    downloadTextFile(download.filename, download.content, download.mimeType);
  }

  async function handleRewrite() {
    if (!onRewrite || isDirty) {
      return;
    }

    try {
      const rewritten = await onRewrite();

      if (
        liveDraft.current.identifier !== artifact.identifier ||
        liveDraft.current.content !== content ||
        liveDraft.current.revision !== base.revision
      ) {
        throw new Error(
          "Your draft changed while the rewrite was being prepared. Save it and try again.",
        );
      }

      setBase({ content: artifact.content, revision: rewritten.sourceRevision });
      setContent(rewritten.body);
      setSelection(null);
      setActiveView("edit");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to rewrite document"));
    }
  }

  async function handleSave() {
    if (!onSave || base.revision === undefined) {
      return;
    }

    try {
      await onSave(content, base.revision);
      if (
        liveDraft.current.identifier === artifact.identifier &&
        liveDraft.current.revision === base.revision
      ) {
        setBase({ content, revision: base.revision + 1 });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to save document"));
    }
  }

  return {
    editorContainerRef,
    editorRef,
    content,
    selection,
    activeView,
    setActiveView,
    isDirty,
    remoteChanged,
    outline,
    documentStats,
    handleContentChange,
    resetToLatest,
    handleSelectionChange,
    handleAddSelectionToChat,
    handleApplyMarkdownEdit,
    handleOutlineClick,
    handleDownload,
    handleRewrite,
    handleSave,
  };
}
