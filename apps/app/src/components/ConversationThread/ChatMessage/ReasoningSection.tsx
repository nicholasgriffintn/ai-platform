import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Markdown } from "~/components/ui/Markdown";

interface ReasoningSectionProps {
	reasoning: {
		content: string;
		collapsed: boolean;
	};
}

export const ReasoningSection = ({ reasoning }: ReasoningSectionProps) => {
	const [collapsed, setCollapsed] = useState(reasoning.collapsed);

	useEffect(() => {
		if (reasoning.collapsed === false && collapsed === true) {
			setCollapsed(false);
		}
	}, [reasoning.collapsed, collapsed]);

	return (
		<div className="mb-2">
			<button
				type="button"
				onClick={() => {
					setCollapsed(!collapsed);
				}}
				className="cursor-pointer flex items-center text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
				aria-label="Toggle reasoning"
			>
				{!collapsed ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
				<span>Reasoning</span>
			</button>
			{!collapsed && (
				<div>
					<Markdown className="prose dark:prose-invert prose-zinc prose-xs text-xs text-zinc-500 dark:text-zinc-400 mt-1">
						{reasoning.content}
					</Markdown>
				</div>
			)}
		</div>
	);
};
