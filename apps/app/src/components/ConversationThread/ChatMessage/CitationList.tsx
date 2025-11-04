import { useState } from "react";
import { Favicon } from "~/components/ui/Favicon";

interface CitationListProps {
	citations:
		| {
				url: string;
				title?: string;
		  }[]
		| string[];
	maxDisplayed?: number;
}

export const CitationList = ({
	citations,
	maxDisplayed = 3,
}: CitationListProps) => {
	const [showAllCitations, setShowAllCitations] = useState(false);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	if (citations.length === 0) {
		return null;
	}

	const displayedCitations = showAllCitations
		? citations
		: citations.slice(0, maxDisplayed);
	const hasMoreCitations = citations.length > maxDisplayed;

	if (displayedCitations.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center mb-2 mt-2">
			<div className="text-sm text-zinc-500 dark:text-zinc-400 mr-2">
				Sources:
			</div>
			<div className="flex">
				{displayedCitations.map((url, index) => (
					<div
						key={typeof url === "string" ? url : url.url}
						className={`
              flex-shrink-0 -ml-2 first:ml-0 relative
              ${hoveredIndex === index ? "z-10" : "z-0"}
              transition-all duration-200
            `}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
						title={typeof url === "string" ? url : url.title || url.url}
					>
						<a
							href={typeof url === "string" ? url : url.url}
							target="_blank"
							rel="noopener noreferrer"
							className={`
                block no-underline
                ${hoveredIndex === index ? "transform scale-125" : ""}
                transition-all duration-200 ease-in-out
              `}
							aria-label={`Citation source: ${typeof url === "string" ? url : url.title || url.url}`}
						>
							<Favicon
								url={typeof url === "string" ? url : url.title || url.url}
								className={`
                  w-6 h-6 rounded-full border border-zinc-200 dark:border-zinc-700 
                  bg-white object-contain p-[2px]
                  ${hoveredIndex === index ? "shadow-md" : ""}
                `}
							/>
						</a>
					</div>
				))}
			</div>
			{hasMoreCitations && (
				<button
					type="button"
					onClick={() => setShowAllCitations(!showAllCitations)}
					className="cursor-pointer ml-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
					aria-label={
						showAllCitations
							? "Show fewer citations"
							: `Show ${citations.length - maxDisplayed} more citations`
					}
				>
					{showAllCitations
						? "Show less"
						: `+${citations.length - maxDisplayed} more`}
				</button>
			)}
		</div>
	);
};
