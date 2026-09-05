import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ReasoningSectionProps {
  reasoning: {
    content: string;
    collapsed: boolean;
  };
}

export const ReasoningSection = ({ reasoning }: ReasoningSectionProps) => {
  const [collapsed, setCollapsed] = useState(reasoning.collapsed);
  const previousCollapsed = useRef(reasoning.collapsed);

  const content = reasoning.content;

  useEffect(() => {
    if (previousCollapsed.current !== reasoning.collapsed) {
      previousCollapsed.current = reasoning.collapsed;
      setCollapsed(reasoning.collapsed);
    }
  }, [reasoning.collapsed]);

  if (!content || content.trim() === "") {
    return null;
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => {
          setCollapsed(!collapsed);
        }}
        className="cursor-pointer flex items-center text-xs text-muted-foreground hover:text-foreground"
        aria-label="Toggle reasoning"
        aria-expanded={!collapsed}
      >
        <span>Reasoning</span>
        {!collapsed ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {!collapsed && (
        <div>
          <MemoizedMarkdown className="prose dark:prose-invert prose-zinc prose-xs text-xs text-muted-foreground mt-1">
            {content}
          </MemoizedMarkdown>
        </div>
      )}
    </div>
  );
};
