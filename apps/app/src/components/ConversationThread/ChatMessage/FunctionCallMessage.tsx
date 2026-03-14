import { Hammer } from "lucide-react";

import type { Message } from "~/types";

interface FunctionCallMessageProps {
	message: Message;
}

export const FunctionCallMessage = ({ message }: FunctionCallMessageProps) => {
	return (
		<div className="mb-2">
			<div className="text-xs font-medium text-amber-700 dark:text-amber-300">
				{message.name}
			</div>
			<div className="mt-1 space-y-2 hidden">
				{Array.isArray(message.tool_calls) &&
					message.tool_calls?.map((tool, i) => (
						<div
							key={tool.id || i}
							className="rounded bg-amber-100/50 p-2 dark:bg-amber-900/20"
						>
							<div className="text-xs font-medium">{tool.function.name}</div>
							<pre className="mt-1 overflow-x-auto text-xs">
								{(() => {
									try {
										const args = tool.function.arguments;
										if (typeof args === "string") {
											return JSON.stringify(JSON.parse(args), null, 2);
										}

										return JSON.stringify(args, null, 2);
									} catch {
										return typeof tool.function.arguments === "string"
											? tool.function.arguments
											: JSON.stringify(tool.function.arguments);
									}
								})()}
							</pre>
						</div>
					))}
			</div>
		</div>
	);
};

export const FunctionCallIcon = () => (
	<Hammer size={18} className="text-amber-600 dark:text-amber-400" />
);
