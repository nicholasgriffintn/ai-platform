import { Button } from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Link2, Trash2 } from "lucide-react";

export interface ShareLink {
  id: string;
  createdAt: string;
  expiresAt?: string | null;
}

export interface ShareLinkListProps {
  shares: ShareLink[];
  onRevoke: (shareId: string) => void;
  revokingShareId?: string | null;
}

export function ShareLinkList({ shares, onRevoke, revokingShareId }: ShareLinkListProps) {
  if (!shares.length) {
    return null;
  }

  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">Active share links</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Anyone with one of these links can view this output.
        </p>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {shares.map((share) => (
          <div key={share.id} className="flex items-center gap-3 px-3 py-2.5">
            <Link2 size={15} className="shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Share link</p>
              <p className="text-xs text-muted-foreground">
                Created {formatDate(share.createdAt)}
                {share.expiresAt ? ` · Expires ${formatDate(share.expiresAt)}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={<Trash2 size={14} />}
              isLoading={revokingShareId === share.id}
              onClick={() => onRevoke(share.id)}
            >
              Revoke
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
