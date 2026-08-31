import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { fixMarkdown } from "@ngriffin_uk/polychat-utility-core";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { Check, Copy } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Children, isValidElement, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

type PreProps = ComponentPropsWithoutRef<"pre">;
type TableProps = ComponentPropsWithoutRef<"table">;

const readFencedCode = (children: ReactNode): { language?: string; text: string } => {
  const child = Children.toArray(children).find(isValidElement) as
    | { props: { className?: string; children?: ReactNode } }
    | undefined;

  if (!child) {
    return { text: "" };
  }

  const languageClass = child.props.className
    ?.split(/\s+/)
    .find((name) => name.startsWith("language-"));

  return {
    language: languageClass?.slice("language-".length),
    text: readTextContent(child.props.children),
  };
};

const readTextContent = (node: ReactNode): string => {
  if (typeof node === "string") {
    return node;
  }

  if (typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(readTextContent).join("");
  }

  if (isValidElement(node)) {
    return readTextContent((node.props as { children?: ReactNode }).children);
  }

  return "";
};

const CodeBlock = ({ children, ...props }: PreProps) => {
  const { copied, copy } = useCopyToClipboard();
  const { language, text } = readFencedCode(children);

  return (
    <div className="group/code relative my-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/60">
        <span className="font-mono text-[0.68rem] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {language || "code"}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => text && copy(text)}
          className="gap-1 px-1.5 text-[0.68rem]"
          aria-label={copied ? "Code copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
          icon={copied ? <Check size={12} /> : <Copy size={12} />}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        {...props}
        className={cn(
          "!my-0 overflow-x-auto !rounded-none !border-0 p-3 text-sm",
          !language && "hljs",
        )}
      >
        {children}
      </pre>
    </div>
  );
};

const components = {
  pre: CodeBlock,
  table: ({ children, ...props }: TableProps) => (
    <div className="my-4 overflow-x-auto">
      <table {...props} className="text-sm">
        {children}
      </table>
    </div>
  ),
};

const rehypePlugins = [() => rehypeHighlight({ detect: false })];
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
        <span
          className="ml-1 inline-block h-4 w-2 animate-pulse bg-blue-500 align-text-bottom"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export const MemoizedMarkdown = memo(Markdown);
