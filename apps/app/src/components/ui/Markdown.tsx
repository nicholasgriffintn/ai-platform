import { memo, useMemo } from "react";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { useChatManager } from "~/hooks/useChatManager";
import { cleanIncompleteMarkdown } from "~/lib/markdown-utils";
import { useChatStore } from "~/state/stores/chatStore";

const rehypePlugins = [() => rehypeHighlight({ detect: true })];
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

function downgradeH1Headings(markdown: string): string {
  return markdown.replace(/^# (.*)$/gm, "## $1");
}

export interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  const { streamStarted } = useChatManager();
  const { currentConversationId } = useChatStore();

  const markdownClassName = useMemo(
    () => `markdown prose dark:prose-invert prose-zinc ${className || ""}`,
    [className],
  );

  const processedMarkdown = useMemo(() => {
    let content = downgradeH1Headings(children);

    if (streamStarted && currentConversationId) {
      content = cleanIncompleteMarkdown(content);
    }

    return content;
  }, [children, streamStarted, currentConversationId]);

  return (
    <ReactMarkdown
      components={components}
      className={markdownClassName}
      rehypePlugins={rehypePlugins}
      remarkPlugins={remarkPlugins}
    >
      {processedMarkdown}
    </ReactMarkdown>
  );
}

export const MemoizedMarkdown = memo(Markdown);
