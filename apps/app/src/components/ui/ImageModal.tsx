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
      <button
        type="button"
        className={cn("cursor-pointer", thumbnailClassName)}
        onClick={() => setOpen(true)}
        aria-label="View larger image"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <img
          src={src}
          alt={alt}
          className={cn("max-h-48 w-auto object-contain", imageClassName)}
          crossOrigin="anonymous"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen} width="auto">
        <DialogContent className={cn("p-0 bg-transparent border-0", className)}>
          <div className="flex items-center justify-center p-2">
            <img
              src={src}
              alt={alt}
              className={cn(
                "max-w-full object-contain rounded-lg",
                "max-h-[85vh]",
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
