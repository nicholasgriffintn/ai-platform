import {
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ngriffin_uk/polychat-component-ui";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";

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

export interface MediaOpenRequest {
  src: string;
  alt: string;
  downloadHref?: string;
  crossOrigin?: "anonymous" | "use-credentials";
}

type MediaOpener = (request: MediaOpenRequest) => void;

const MediaOpenerContext = createContext<MediaOpener | null>(null);

export function MediaOpenerProvider({
  children,
  onOpen,
}: {
  children: ReactNode;
  onOpen: MediaOpener;
}) {
  return <MediaOpenerContext.Provider value={onOpen}>{children}</MediaOpenerContext.Provider>;
}

export function MarkdownImage({
  src,
  alt = "Image",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const openMedia = useContext(MediaOpenerContext);
  const image = <img src={src} alt={alt} {...props} />;

  if (!openMedia || !src) {
    return image;
  }

  return (
    <button type="button" aria-label={`View ${alt} larger`} onClick={() => openMedia({ src, alt })}>
      {image}
    </button>
  );
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
  const openMedia = useContext(MediaOpenerContext);
  const previewClassName = ["polychat-content-image-preview", thumbnailClassName]
    .filter(Boolean)
    .join(" ");
  const thumbnail = (
    <img
      src={src}
      alt={alt}
      className={imageClassName}
      crossOrigin={crossOrigin}
      decoding="async"
    />
  );
  const download = downloadHref ? (
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
  ) : null;

  if (openMedia) {
    return (
      <div className={previewClassName}>
        <button
          type="button"
          aria-label={`View ${alt} larger`}
          onClick={() => openMedia({ src, alt, downloadHref, crossOrigin })}
        >
          {thumbnail}
        </button>
        {download}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={previewClassName}>
        <DialogTrigger asChild>
          <button type="button" aria-label={`View ${alt} larger`}>
            {thumbnail}
          </button>
        </DialogTrigger>
        {download}
      </div>
      <DialogContent
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
