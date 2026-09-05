import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormInput,
  FormSelect,
  LoadingRegion,
  SkeletonList,
} from "@ngriffin_uk/polychat-component-ui";
import type { SharedAgentSummary } from "@ngriffin_uk/polychat-schemas";
import { parseStringArrayValue } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useState } from "react";

export interface ShareAgentModalProps {
  open: boolean;
  onClose: () => void;
  onShare: (data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
  }) => Promise<unknown>;
  onUnshare: (sharedAgentId: string) => Promise<unknown>;
  isSharing: boolean;
  isUnsharing: boolean;
  isLoadingListing: boolean;
  listing: SharedAgentSummary | null;
  error?: Error | null;
  agent: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  categories: string[];
}

export function ShareAgentModal({
  open,
  onClose,
  onShare,
  onUnshare,
  isSharing,
  isUnsharing,
  isLoadingListing,
  listing,
  error,
  agent,
  categories,
}: ShareAgentModalProps) {
  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareCategory, setShareCategory] = useState("");
  const [shareTagsInput, setShareTagsInput] = useState("");

  useEffect(() => {
    if (open && agent) {
      setShareName(agent.name);
      setShareDescription(agent.description ?? "");
      setShareCategory("");
      setShareTagsInput("");
    }
  }, [open, agent]);

  if (!agent) {
    return null;
  }

  const submitShare = async () => {
    await onShare({
      name: shareName,
      description: shareDescription,
      category: shareCategory,
      tags: shareTagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  };

  const listedTags = listing ? parseStringArrayValue(listing.tags) : [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{listing ? "Sharing settings" : "Share agent"}</DialogTitle>
          <DialogDescription>
            {listing
              ? "This agent is listed in the public marketplace where anyone can install a copy."
              : "Publish a copy of this agent to the public marketplace. Your own agent stays yours."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-sm text-failure">
            {error.message}
          </p>
        )}

        {isLoadingListing ? (
          <LoadingRegion label="Checking sharing status">
            <SkeletonList count={2} />
          </LoadingRegion>
        ) : listing ? (
          <>
            <div className="space-y-2 rounded-lg border border-border p-4">
              <p className="text-sm font-medium">{listing.name}</p>
              {listing.description && (
                <p className="text-sm text-muted-foreground">{listing.description}</p>
              )}
              {(listing.category || listedTags.length > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {listing.category && (
                    <Badge variant="secondary" className="text-xs">
                      {listing.category}
                    </Badge>
                  )}
                  {listedTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                Installed {listing.usage_count ?? 0} times. Copies people already installed stay
                with them.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isUnsharing}>
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                isLoading={isUnsharing}
                disabled={isUnsharing}
                onClick={() => void onUnshare(listing.id)}
              >
                Stop sharing
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitShare();
            }}
          >
            <FormInput
              label="Name"
              value={shareName}
              onChange={(event) => setShareName(event.target.value)}
              required
            />
            <FormInput
              label="Description"
              value={shareDescription}
              onChange={(event) => setShareDescription(event.target.value)}
            />
            <FormSelect
              label="Category"
              value={shareCategory}
              onChange={(event) => setShareCategory(event.target.value)}
              options={[
                { value: "", label: "Select category" },
                ...categories.map((category) => ({ value: category, label: category })),
              ]}
            />
            <FormInput
              label="Tags (comma separated)"
              value={shareTagsInput}
              onChange={(event) => setShareTagsInput(event.target.value)}
              placeholder="writing, assistant, productivity"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSharing}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSharing} disabled={isSharing}>
                Share agent
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
