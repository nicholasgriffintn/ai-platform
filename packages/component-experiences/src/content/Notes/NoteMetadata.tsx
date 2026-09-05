import {
  Badge,
  Button,
  cn,
  Input,
  Textarea,
  textLinkClassName,
} from "@ngriffin_uk/polychat-component-ui";
import type { NoteMetadata as NoteMetadataType } from "@ngriffin_uk/polychat-schemas";
import { Calendar, Clock, Edit3, FileText, Hash, Monitor, Tag, User } from "lucide-react";
import { useState } from "react";

interface NoteMetadataProps {
  metadata?: NoteMetadataType;
  onMetadataUpdate?: (metadata: NoteMetadataType) => void;
  isEditable?: boolean;
  canRegenerate?: boolean;
  onRegenerateMetadata?: () => void;
  isRegeneratingMetadata?: boolean;
}

export function NoteMetadata({
  metadata,
  onMetadataUpdate,
  isEditable = false,
  canRegenerate = false,
  onRegenerateMetadata,
  isRegeneratingMetadata = false,
}: NoteMetadataProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState(metadata || {});

  if (!metadata && !isEditable) {
    return null;
  }

  const handleSave = () => {
    onMetadataUpdate?.(editingMetadata);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingMetadata(metadata || {});
    setIsEditing(false);
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    setEditingMetadata((prev) => ({ ...prev, tags }));
  };

  const handleKeyTopicsChange = (value: string) => {
    const keyTopics = value
      .split(",")
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);

    setEditingMetadata((prev) => ({ ...prev, keyTopics }));
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-success/12 text-success";
      case "negative":
        return "bg-failure/12 text-failure";
      default:
        return "bg-selection text-muted-foreground";
    }
  };

  const getSourceTypeIcon = (sourceType?: string) => {
    switch (sourceType) {
      case "tab_recording":
        return <Monitor size={14} className="text-muted-foreground" />;
      case "manual":
        return <User size={14} className="text-muted-foreground" />;
      default:
        return <FileText size={14} className="text-muted-foreground" />;
    }
  };

  if (isEditing) {
    return (
      <div className="border-border bg-surface-elevated space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
            <Hash size={16} className="text-muted-foreground" />
            Edit Metadata
          </h3>
          <div className="flex gap-2">
            {canRegenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRegenerateMetadata}
                disabled={isRegeneratingMetadata}
              >
                {isRegeneratingMetadata ? "Regenerating..." : "Regenerate via AI"}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <label htmlFor="summary-input" className="text-xs font-medium text-muted-foreground">
              Summary
            </label>
            <Textarea
              id="summary-input"
              value={editingMetadata.summary || ""}
              onChange={(e) =>
                setEditingMetadata((prev) => ({
                  ...prev,
                  summary: e.target.value,
                }))
              }
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <label htmlFor="tags-input" className="text-xs font-medium text-muted-foreground">
              Tags (comma separated)
            </label>
            <Input
              id="tags-input"
              value={editingMetadata.tags?.join(", ") || ""}
              onChange={(e) => handleTagsChange(e.target.value)}
              className="bg-surface text-foreground mt-1"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div>
            <label htmlFor="topics-input" className="text-xs font-medium text-muted-foreground">
              Key Topics (comma separated)
            </label>
            <Input
              id="topics-input"
              value={editingMetadata.keyTopics?.join(", ") || ""}
              onChange={(e) => handleKeyTopicsChange(e.target.value)}
              className="bg-surface text-foreground mt-1"
              placeholder="topic1, topic2, topic3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="content-type-select"
                className="text-xs font-medium text-muted-foreground"
              >
                Content Type
              </label>
              <select
                id="content-type-select"
                value={editingMetadata.contentType || "text"}
                onChange={(e) =>
                  setEditingMetadata((prev) => ({
                    ...prev,
                    contentType: e.target.value,
                  }))
                }
                className="border-border bg-surface text-foreground mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="text">Text</option>
                <option value="list">List</option>
                <option value="outline">Outline</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="sentiment-select"
                className="text-xs font-medium text-muted-foreground"
              >
                Sentiment
              </label>
              <select
                id="sentiment-select"
                value={editingMetadata.sentiment || "neutral"}
                onChange={(e) =>
                  setEditingMetadata((prev) => ({
                    ...prev,
                    sentiment: e.target.value,
                  }))
                }
                className="border-border bg-surface text-foreground mt-1 w-full rounded-md border px-3 py-2"
              >
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
          </div>

          {editingMetadata.tabSource && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Monitor size={14} className="text-muted-foreground" />
                Capture Source
              </h4>
              <div className="grid gap-3">
                <div>
                  <label
                    htmlFor="tab-title-input"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Title
                  </label>
                  <Input
                    id="tab-title-input"
                    value={editingMetadata.tabSource?.title || ""}
                    onChange={(e) =>
                      setEditingMetadata((prev) => ({
                        ...prev,
                        tabSource: { ...prev.tabSource, title: e.target.value },
                      }))
                    }
                    className="bg-surface text-foreground mt-1"
                    placeholder="Source title"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tab-url-input"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    URL
                  </label>
                  <Input
                    id="tab-url-input"
                    value={editingMetadata.tabSource?.url || ""}
                    onChange={(e) =>
                      setEditingMetadata((prev) => ({
                        ...prev,
                        tabSource: { ...prev.tabSource, url: e.target.value },
                      }))
                    }
                    className="bg-surface text-foreground mt-1"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-surface-elevated space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
          <Hash size={16} className="text-muted-foreground" />
          Note Metadata
        </h3>
        <div className="flex items-center gap-2">
          {canRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateMetadata}
              disabled={isRegeneratingMetadata}
            >
              {isRegeneratingMetadata ? "Regenerating..." : "Regenerate via AI"}
            </Button>
          )}
          {isEditable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              aria-label="Edit note metadata"
            >
              <Edit3 size={14} />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {metadata?.summary && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Summary</div>
            <p className="text-sm text-foreground">{metadata.summary}</p>
          </div>
        )}

        {metadata?.tags && metadata.tags.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Tag size={12} className="text-muted-foreground" />
              Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {metadata.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {metadata?.keyTopics && metadata.keyTopics.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Key Topics</div>
            <div className="flex flex-wrap gap-1">
              {metadata.keyTopics.map((topic: string) => (
                <Badge key={topic} variant="outline" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-xs">
          {metadata?.wordCount !== undefined && (
            <div className="flex items-center gap-1">
              <FileText size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Words:</span>
              <span className="text-foreground">{metadata.wordCount.toLocaleString()}</span>
            </div>
          )}

          {metadata?.readingTime !== undefined && (
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Read:</span>
              <span className="text-foreground">{metadata.readingTime}min</span>
            </div>
          )}

          {metadata?.contentType && (
            <div className="flex items-center gap-1">
              <FileText size={12} className="text-muted-foreground" />
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize text-foreground">{metadata.contentType}</span>
            </div>
          )}

          {metadata?.sentiment && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "px-2 py-1 rounded text-xs capitalize",
                  getSentimentColor(metadata.sentiment),
                )}
              >
                {metadata.sentiment}
              </span>
            </div>
          )}

          {metadata?.sourceType && (
            <div className="flex items-center gap-1">
              {getSourceTypeIcon(metadata.sourceType)}
              <span className="text-muted-foreground">Source:</span>
              <span className="capitalize text-foreground">
                {metadata.sourceType.replace("_", " ")}
              </span>
            </div>
          )}
        </div>

        {metadata?.tabSource && (
          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Monitor size={12} className="text-muted-foreground" />
              Capture Source
            </div>
            <div className="text-xs space-y-1">
              {metadata.tabSource.title && (
                <div>
                  <span className="text-muted-foreground">Title:</span>{" "}
                  <span className="text-foreground">{metadata.tabSource.title}</span>
                </div>
              )}
              {metadata.tabSource.url && (
                <div>
                  <span className="text-muted-foreground">URL:</span>
                  <a
                    href={metadata.tabSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={textLinkClassName({ tone: "accent", className: "ml-1" })}
                  >
                    {metadata.tabSource.url}
                  </a>
                </div>
              )}
              {metadata.tabSource.timestamp && (
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Captured:</span>
                  <span className="text-foreground">
                    {new Date(metadata.tabSource.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
