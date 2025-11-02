import { Download } from "lucide-react";
import { useState } from "react";

import { cn } from "~/lib/utils";
import { Dialog, DialogClose, DialogContent } from "./Dialog";

interface ImageModalProps {
	src: string;
	alt?: string;
	className?: string;
	imageClassName?: string;
	thumbnailClassName?: string;
	maxHeight?: string;
}

export function ImageModal({
	src,
	alt = "Image",
	className,
	imageClassName,
	thumbnailClassName,
	maxHeight = "85vh",
}: ImageModalProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<div className={cn("relative inline-block", thumbnailClassName)}>
				<button
					type="button"
					className="cursor-pointer"
					onClick={() => setOpen(true)}
					aria-label="View larger image"
				>
					<img
						src={src}
						alt={alt}
						className={cn("max-w-full h-auto object-contain", imageClassName)}
						crossOrigin="anonymous"
					/>
				</button>
				<a
					href={src}
					download={alt || src.split("/").pop() || "image"}
					target="_blank"
					rel="noreferrer"
					title="Download image"
					className="absolute top-2 right-2 z-10 p-2 bg-white/75 rounded-full hover:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
				>
					<Download className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
				</a>
			</div>

			<Dialog open={open} onOpenChange={setOpen} width="auto">
				<DialogContent className={cn("p-0 bg-transparent border-0", className)}>
					<div className="flex items-center justify-center p-2">
						<img
							src={src}
							alt={alt}
							className={cn(
								"w-auto h-auto max-w-full object-contain rounded-lg",
								imageClassName,
							)}
							style={{ maxHeight }}
							crossOrigin="anonymous"
						/>
					</div>
					<DialogClose onClick={() => setOpen(false)} />
				</DialogContent>
			</Dialog>
		</>
	);
}
