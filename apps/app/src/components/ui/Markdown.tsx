import { memo, useMemo } from "react";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const rehypePlugins = [rehypeHighlight];
const remarkPlugins = [remarkGfm];

type CodeProps = ComponentPropsWithoutRef<"code"> & { node?: unknown };
type TableProps = ComponentPropsWithoutRef<"div"> & {
  children?: React.ReactNode;
};

const components = {
  code: ({ node, ...props }: CodeProps) => (
    <code {...props}>{props.children}</code>
  ),
  table: ({ children }: TableProps) => (
    <div className="overflow-x-scroll text-sm">{children}</div>
  ),
};

export function Markdown({
  children,
  className,
}: { children: string; className?: string }) {
  const markdownClassName = useMemo(
    () => `prose dark:prose-invert prose-zinc ${className || ""}`,
    [className],
  );

  return (
    <ReactMarkdown
      components={components}
      className={markdownClassName}
      rehypePlugins={rehypePlugins}
      remarkPlugins={remarkPlugins}
    >
      {children}
    </ReactMarkdown>
  );
}

export const MemoizedMarkdown = memo(Markdown);
