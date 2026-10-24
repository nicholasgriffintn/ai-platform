import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { MindMapNode, MindMapOutputContent } from "@ngriffin_uk/polychat-schemas";
import { ChevronRight, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";

export interface MindMapViewProps {
  content: MindMapOutputContent;
  onAskAbout?: (topic: string) => void;
}

function MindMapBranch({
  node,
  depth,
  path,
  onAskAbout,
}: {
  node: MindMapNode;
  depth: number;
  path: string;
  onAskAbout?: (topic: string) => void;
}) {
  const children = node.children ?? [];
  const [open, setOpen] = useState(depth < 2);

  return (
    <li className="flex flex-col gap-1">
      <div
        className={cn(
          "group flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2",
          depth === 0 && "border-primary/40 bg-primary/5",
        )}
      >
        <button
          type="button"
          aria-expanded={children.length > 0 ? open : undefined}
          aria-label={
            children.length > 0 ? `${open ? "Collapse" : "Expand"} ${node.label}` : undefined
          }
          disabled={children.length === 0}
          onClick={() => setOpen((current) => !current)}
          className="mt-0.5 shrink-0 cursor-pointer text-muted-foreground disabled:cursor-default disabled:opacity-0"
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium text-foreground", depth === 0 && "font-display text-lg")}>
            {node.label}
          </p>
          {node.summary ? <p className="text-sm text-muted-foreground">{node.summary}</p> : null}
        </div>
        {onAskAbout ? (
          <button
            type="button"
            onClick={() => onAskAbout(path)}
            aria-label={`Ask about ${node.label}`}
            title="Ask about this"
            className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
          >
            <MessageCircleQuestion className="size-4" />
          </button>
        ) : null}
      </div>
      {open && children.length > 0 ? (
        <ul className="ml-5 flex flex-col gap-1 border-l border-border pl-4">
          {children.map((child) => (
            <MindMapBranch
              key={child.label}
              node={child}
              depth={depth + 1}
              path={`${path} › ${child.label}`}
              onAskAbout={onAskAbout}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function MindMapView({ content, onAskAbout }: MindMapViewProps) {
  return (
    <ul className="flex flex-col gap-1" aria-label="Mind map">
      <MindMapBranch
        node={content.root}
        depth={0}
        path={content.root.label}
        onAskAbout={onAskAbout}
      />
    </ul>
  );
}
