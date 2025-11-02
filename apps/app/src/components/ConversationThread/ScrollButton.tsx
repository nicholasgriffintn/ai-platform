import { ChevronDown } from "lucide-react";

interface ScrollButtonProps {
	onClick: () => void;
}

export const ScrollButton = ({ onClick }: ScrollButtonProps) => {
	return (
		<div className="sticky bottom-6 flex justify-center px-4">
			<button
				type="button"
				onClick={onClick}
				className="cursor-pointer flex items-center gap-2 bg-zinc-800/90 dark:bg-zinc-700/90 text-white px-4 py-2 rounded-full shadow-lg hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-all z-10 focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm text-sm font-medium"
				aria-label="Scroll to bottom"
			>
				<span>Scroll to bottom</span>
				<ChevronDown size={16} />
			</button>
		</div>
	);
};
