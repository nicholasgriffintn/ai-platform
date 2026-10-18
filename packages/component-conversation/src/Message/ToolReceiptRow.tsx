import { cn } from "@ngriffin_uk/polychat-component-ui";
import { describeToolReceipt } from "@ngriffin_uk/polychat-library-chat/tool-receipts";
import type { ToolReceipt } from "@ngriffin_uk/polychat-schemas";
import { CheckCircle2, ChevronDown, ChevronRight, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function ToolReceiptRow({
  receipt,
  children,
  className,
}: {
  receipt: ToolReceipt;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = receipt.outcome === "drafted" ? PenLine : CheckCircle2;

  return (
    <div className={cn("mb-2", className)} data-tool-name={receipt.tool} data-receipt>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon
          size={14}
          aria-hidden="true"
          className={cn(
            "shrink-0",
            receipt.outcome === "drafted" ? "text-attention" : "text-success",
          )}
        />
        <span className="min-w-0 truncate">{describeToolReceipt(receipt)}</span>
        {children ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="ml-auto flex shrink-0 cursor-pointer items-center gap-0.5 transition-colors hover:text-foreground"
            aria-expanded={open}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span>Details</span>
          </button>
        ) : null}
      </div>
      {open && children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
