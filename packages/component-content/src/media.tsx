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
    <>
      <div
        className={["polychat-content-image-preview", thumbnailClassName].filter(Boolean).join(" ")}
      >
        <button type="button" onClick={() => setOpen(true)} aria-label={`View ${alt} larger`}>
          <img
            src={src}
            alt={alt}
            className={imageClassName}
            crossOrigin={crossOrigin}
            decoding="async"
          />
        </button>
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
      {open && (
        <div
          className={["polychat-content-image-modal", className].filter(Boolean).join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
              setOpen(false);
            }
          }}
          tabIndex={-1}
        >
          <button
            type="button"
            className="polychat-content-image-close"
            onClick={() => setOpen(false)}
            aria-label="Close image preview"
          >
            ×
          </button>
          <img
            src={src}
            alt={alt}
            className={imageClassName}
            style={{ maxHeight }}
            crossOrigin={crossOrigin}
            decoding="async"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
