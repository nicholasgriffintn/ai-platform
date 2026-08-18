import { fixMarkdown } from "@ngriffin_uk/polychat-utility-core";
import type { ComponentPropsWithoutRef } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

type CodeProps = ComponentPropsWithoutRef<"code"> & { node?: unknown };
type TableProps = ComponentPropsWithoutRef<"div"> & { children?: React.ReactNode };

const components = {
  code: ({ node: _node, ...props }: CodeProps) => <code {...props}>{props.children}</code>,
  table: ({ children }: TableProps) => <div className="overflow-x-scroll text-sm">{children}</div>,
};
const rehypePlugins = [() => rehypeHighlight({ detect: true })];
const remarkPlugins = [remarkGfm];

export interface MarkdownProps {
  children: string;
  className?: string;
  isStreaming?: boolean;
}

export function Markdown({ children, className, isStreaming = false }: MarkdownProps) {
  const markdownClassName = useMemo(
    () => `markdown prose dark:prose-invert prose-zinc ${className || ""}`,
    [className],
  );
  const processedMarkdown = useMemo(
    () => fixMarkdown(children, isStreaming),
    [children, isStreaming],
  );

  return (
    <div className={`relative ${markdownClassName}`}>
      <ReactMarkdown
        components={components}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
      >
        {processedMarkdown}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-blue-500" aria-hidden="true" />
      )}
    </div>
  );
}

export const MemoizedMarkdown = memo(Markdown);
