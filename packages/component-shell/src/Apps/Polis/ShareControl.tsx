import { Button } from "@ngriffin_uk/polychat-component-ui";
import { YEAR_DAYS } from "@ngriffin_uk/polychat-library-polis";
import { Check, Copy, Share2, X } from "lucide-react";
import { useState } from "react";

import type { PolisEngine } from "./usePolisEngine.js";

export function ShareControl({ engine }: { engine: PolisEngine }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { share } = engine;

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Share the town"
        title="Share the town"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Share2 size={16} />
      </Button>
      {open && (
        <div className="absolute right-0 bottom-12 w-80 space-y-2 rounded-lg border border-border bg-card p-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Share this town</p>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={14} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with the link can watch the town back up to now, hour by hour. They cannot change
            it, and anything that happens after you share stays private until you share again.
          </p>
          {share.status === "shared" ? (
            <div className="space-y-2">
              <div className="flex gap-1">
                <input
                  readOnly
                  value={share.url}
                  aria-label="Share link"
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy link"
                  onClick={() => void copy(share.url)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                Shared up to year {Math.floor(share.day / YEAR_DAYS) + 1}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="xs" onClick={engine.shareTown}>
                  Share again with the latest
                </Button>
                <Button variant="ghost" size="xs" onClick={() => void engine.stopSharing()}>
                  Stop sharing
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Share2 size={14} />}
              isLoading={share.status === "sharing"}
              onClick={() => {
                setCopied(false);
                engine.shareTown();
              }}
            >
              Create a public link
            </Button>
          )}
          {share.status === "failed" && <p className="text-xs text-failure">{share.message}</p>}
        </div>
      )}
    </div>
  );
}
