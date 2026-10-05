import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import type { MarkdownEditAction } from "@ngriffin_uk/polychat-library-chat/markdown-editor";
import type { TextAnchor } from "@ngriffin_uk/polychat-utility-core";
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
  Save,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";

import { MemoizedMarkdown } from "../markdown";
import { useDocumentEditor, type DocumentEditorOptions } from "./useDocumentEditor";

interface ArtifactDocumentEditorProps extends DocumentEditorOptions {
  isSaving?: boolean;
  saveErrorMessage?: string;
  isRewriting?: boolean;
  rewriteErrorMessage?: string;
  renderDiscussion?: (selection: TextAnchor | null, hasUnsavedChanges: boolean) => ReactNode;
}

export const ArtifactDocumentEditor = ({
  artifact,
  sourceRevision,
  renderDiscussion,
  onAddSelectionToChat,
  onSave,
  isSaving,
  saveErrorMessage,
  onDownload,
  onRewrite,
  isRewriting,
  rewriteErrorMessage,
}: ArtifactDocumentEditorProps) => {
  const {
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
  } = useDocumentEditor({
    artifact,
    sourceRevision,
    onAddSelectionToChat,
    onSave,
    onDownload,
    onRewrite,
  });

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

        {onRewrite ? (
          <Button
            size="xs"
            variant="outline"
            isLoading={isRewriting}
            disabled={isDirty || isSaving}
            onClick={() => {
              void handleRewrite();
            }}
            icon={<Wand2 size={13} />}
          >
            Rewrite
          </Button>
        ) : null}

        {onSave && isDirty ? (
          <Button
            size="xs"
            variant="outline"
            disabled={isSaving || isRewriting}
            onClick={resetToLatest}
          >
            Cancel
          </Button>
        ) : null}

        {onSave ? (
          <Button
            size="xs"
            variant="outline"
            isLoading={isSaving}
            disabled={!isDirty || sourceRevision === undefined || isRewriting}
            onClick={() => void handleSave()}
            icon={<Save size={13} />}
          >
            Save
          </Button>
        ) : null}

        <Button size="xs" onClick={handleDownload} icon={<Download size={13} />}>
          Download
        </Button>
      </div>

      {remoteChanged && isDirty ? (
        <output className="block border-b border-border px-3 py-2 text-xs text-muted-foreground">
          A newer revision is available. Your draft is kept here. Download it or cancel to use the
          latest revision.
        </output>
      ) : null}

      {(saveErrorMessage ?? rewriteErrorMessage) ? (
        <p
          role="alert"
          className="border-b border-border bg-surface px-3 py-2 text-xs text-failure"
        >
          {saveErrorMessage ?? rewriteErrorMessage}
        </p>
      ) : null}

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

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1">
          {activeView === "edit" ? (
            <div ref={editorContainerRef} className="relative min-h-0 min-w-0 flex-1">
              <Textarea
                ref={editorRef}
                aria-label="Document content"
                value={content}
                onChange={(event) => handleContentChange(event.currentTarget.value)}
                onSelect={handleSelectionChange}
                className="h-full resize-none rounded-none border-0 bg-surface px-6 py-5 font-serif text-[15px] leading-7 focus:ring-0 focus-visible:ring-0"
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
            <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-surface px-6 py-5">
              <MemoizedMarkdown className="max-w-none">{content}</MemoizedMarkdown>
            </div>
          )}
        </div>
        {renderDiscussion ? (
          <aside
            aria-label="Document discussion"
            className="max-h-[50%] w-full overflow-auto border-t border-border bg-surface-elevated md:max-h-none md:w-80 md:shrink-0 md:border-t-0 md:border-l"
          >
            {renderDiscussion(selection?.anchor ?? null, isDirty)}
          </aside>
        ) : null}
      </div>
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
