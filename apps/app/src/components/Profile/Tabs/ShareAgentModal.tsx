import { Loader2 } from "lucide-react";
import React, { useState } from "react";

import { Button } from "~/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { FormInput } from "~/components/ui/Form/Input";
import { FormSelect } from "~/components/ui/Form/Select";

interface ShareAgentModalProps {
  open: boolean;
  onClose: () => void;
  onShare: (data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
  }) => Promise<void>;
  isSharing: boolean;
  agent: {
    id: string;
    name: string;
    description?: string;
  } | null;
  categories: string[];
}

export function ShareAgentModal({
  open,
  onClose,
  onShare,
  isSharing,
  agent,
  categories,
}: ShareAgentModalProps) {
  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareCategory, setShareCategory] = useState("");
  const [shareTagsInput, setShareTagsInput] = useState("");

  React.useEffect(() => {
    if (open && agent) {
      setShareName(agent.name || "");
      setShareDescription(agent.description || "");
      setShareCategory("");
      setShareTagsInput("");
    }
  }, [open, agent]);

  const handleShare = async () => {
    if (!agent) return;

    const tagsArray = shareTagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    await onShare({
      name: shareName,
      description: shareDescription,
      category: shareCategory,
      tags: tagsArray,
    });
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Agent</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleShare();
          }}
        >
          <FormInput
            label="Name"
            value={shareName}
            onChange={(e) => setShareName(e.target.value)}
            required
          />
          <FormInput
            label="Description"
            value={shareDescription}
            onChange={(e) => setShareDescription(e.target.value)}
          />
          <FormSelect
            label="Category"
            value={shareCategory}
            onChange={(e) => setShareCategory(e.target.value)}
            options={[
              { value: "", label: "Select category" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
          <FormInput
            label="Tags (comma separated)"
            value={shareTagsInput}
            onChange={(e) => setShareTagsInput(e.target.value)}
            placeholder="writing, assistant, productivity"
          />

          <hr className="my-4" />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSharing}>
              {isSharing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                "Share Agent"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
