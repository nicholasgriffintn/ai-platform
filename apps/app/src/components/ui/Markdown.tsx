import type { ComponentPropsWithoutRef } from "react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { fixMarkdown } from "~/lib/markdown-utils";

const rehypePlugins = [() => rehypeHighlight({ detect: true })];
const remarkPlugins = [remarkGfm];

type CodeProps = ComponentPropsWithoutRef<"code"> & { node?: unknown };
type TableProps = ComponentPropsWithoutRef<"div"> & {
	children?: React.ReactNode;
};

const components = {
	code: ({ node: _node, ...props }: CodeProps) => (
		<code {...props}>{props.children}</code>
	),
	table: ({ children }: TableProps) => (
		<div className="overflow-x-scroll text-sm">{children}</div>
	),
};

export interface MarkdownProps {
	children: string;
	className?: string;
	isStreaming?: boolean;
}

export function Markdown({ children, className, isStreaming }: MarkdownProps) {
	const markdownClassName = useMemo(
		() => `markdown prose dark:prose-invert prose-zinc ${className || ""}`,
		[className],
	);

	const processedMarkdown = useMemo(() => {
		const content = fixMarkdown(children, isStreaming);

		return content;
	}, [children, isStreaming]);

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
				<span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
			)}
		</div>
	);
}

export const MemoizedMarkdown = memo(Markdown);
