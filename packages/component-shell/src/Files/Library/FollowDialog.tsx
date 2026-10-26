import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useKnowledgeSyncs } from "@ngriffin_uk/polychat-library-react";
import { toast } from "sonner";

import { KnowledgeFollowForm } from "./KnowledgeFollowForm.js";
import { KnowledgeSyncList } from "./KnowledgeSyncList.js";

export function FollowDialog({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const target = projectId ? { projectId } : { library: true as const };
  const { data: syncs = [] } = useKnowledgeSyncs(target);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Follow</DialogTitle>
          <DialogDescription>
            {projectId
              ? "New pages and documents arrive in this project's Files for every member, and anything already filed is reused rather than read twice."
              : "New pages arrive in your Files, and anything already filed is reused rather than read twice."}
          </DialogDescription>
        </DialogHeader>
        {syncs.length > 0 ? (
          <section aria-label="Already followed" className="-mx-2">
            <KnowledgeSyncList target={target} syncs={syncs} />
          </section>
        ) : null}
        <KnowledgeFollowForm
          target={target}
          onDone={() => {
            toast.success("Following. The first pages land shortly.");
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
