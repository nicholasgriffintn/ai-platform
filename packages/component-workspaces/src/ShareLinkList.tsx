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
    <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Active share links</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Anyone with one of these links can view this output.
        </p>
      </div>
      <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {shares.map((share) => (
          <div key={share.id} className="flex items-center gap-3 px-3 py-2.5">
            <Link2 size={15} className="shrink-0 text-zinc-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Share link</p>
              <p className="text-xs text-zinc-500">
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
