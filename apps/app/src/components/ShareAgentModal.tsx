import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { FormInput } from "~/components/ui/Form/Input";
import { FormSelect } from "~/components/ui/Form/Select";
import { Textarea } from "~/components/ui/Textarea";
import { Label } from "~/components/ui/label";
import { useMarketplace } from "~/hooks/useMarketplace";

interface ShareAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: any;
}

export function ShareAgentModal({
  isOpen,
  onClose,
  agent,
}: ShareAgentModalProps) {
  const { shareAgent, isSharingAgent, categories, tags } = useMarketplace();
  const queryClient = useQueryClient();

  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agent?.id) {
      toast.error("Agent ID is required");
      return;
    }

    try {
      await shareAgent({
        agentId: agent.id,
        data: {
          name,
          description,
          category: category || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        },
      });

      toast.success("Agent shared to marketplace successfully!");

      // Invalidate the shared status queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["agent-shared-status"] });
      queryClient.invalidateQueries({
        queryKey: ["multiple-agents-shared-status"],
      });

      onClose();
      resetForm();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to share agent";
      toast.error(errorMessage);
      console.error("Share agent error:", error);
    }
  };

  const resetForm = () => {
    setName(agent?.name || "");
    setDescription(agent?.description || "");
    setCategory("");
    setSelectedTags([]);
    setCustomTag("");
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags([...selectedTags, customTag.trim()]);
      setCustomTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const categoryOptions = [
    { value: "", label: "Select a category (optional)" },
    ...(categories || []).map((cat) => ({ value: cat, label: cat })),
    { value: "Coding", label: "Coding" },
    { value: "Writing", label: "Writing" },
    { value: "Analysis", label: "Analysis" },
    { value: "Creative", label: "Creative" },
    { value: "Productivity", label: "Productivity" },
    { value: "Education", label: "Education" },
    { value: "Other", label: "Other" },
  ];

  const popularTags = tags || [
    "coding",
    "writing",
    "analysis",
    "creative",
    "productivity",
    "education",
    "research",
    "automation",
    "data",
    "communication",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Agent to Marketplace</DialogTitle>
          <DialogClose onClick={onClose} />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Public Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="How should this agent appear in the marketplace?"
            description="This name will be shown to other users"
          />

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this agent does and how it can help others..."
              className="resize-none"
            />
          </div>

          <FormSelect
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
            description="Help users find your agent by selecting a category"
          />

          <div className="space-y-2">
            <Label>Tags</Label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Add tags to help users discover your agent
            </p>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 h-3 w-3 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700/50 flex items-center justify-center"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Popular tags:
              </p>
              <div className="flex flex-wrap gap-1">
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!selectedTags.includes(tag)) {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                    disabled={selectedTags.includes(tag)}
                    className="px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <FormInput
                label=""
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add custom tag..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddCustomTag}
                disabled={
                  !customTag.trim() || selectedTags.includes(customTag.trim())
                }
                className="mt-0"
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSharingAgent}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSharingAgent}
              isLoading={isSharingAgent}
            >
              {isSharingAgent ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                "Share to Marketplace"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
