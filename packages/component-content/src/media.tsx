import {
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import type { ImgHTMLAttributes } from "react";
import { useState } from "react";

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  crossOrigin?: "anonymous" | "use-credentials";
}

export function Image({ alt = "", className, crossOrigin = "anonymous", ...props }: ImageProps) {
  return (
    <img
      alt={alt}
      className={["polychat-content-image", className].filter(Boolean).join(" ")}
      crossOrigin={crossOrigin}
      {...props}
    />
  );
}

export interface ImageModalProps {
  src: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  thumbnailClassName?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  maxHeight?: string;
  downloadHref?: string;
}

export function ImageModal({
  src,
  alt = "Image",
  className,
  imageClassName,
  thumbnailClassName,
  crossOrigin = "anonymous",
  maxHeight = "85vh",
  downloadHref = src,
}: ImageModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        className={["polychat-content-image-preview", thumbnailClassName].filter(Boolean).join(" ")}
      >
        <DialogTrigger asChild>
          <button type="button" aria-label={`View ${alt} larger`}>
            <img
              src={src}
              alt={alt}
              className={imageClassName}
              crossOrigin={crossOrigin}
              decoding="async"
            />
          </button>
        </DialogTrigger>
        {downloadHref && (
          <a
            href={downloadHref}
            download={alt}
            target="_blank"
            rel="noreferrer"
            className="polychat-content-image-download"
            aria-label={`Download ${alt}`}
          >
            <span aria-hidden="true">↓</span>
          </a>
        )}
      </div>
      <DialogContent
        // The image is the whole content, so there is nothing to describe beyond its label.
        aria-describedby={undefined}
        className={cn("w-auto max-w-[95vw] gap-0 p-4 pt-12 sm:max-w-[min(95vw,72rem)]", className)}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className={cn("max-w-full rounded-lg", imageClassName)}
          style={{ maxHeight }}
          crossOrigin={crossOrigin}
          decoding="async"
        />
      </DialogContent>
    </Dialog>
  );
}
