import { ImageModal } from "../media";
import type { GeneratedImageResponseData } from "./response-data";

interface GeneratedImageViewProps {
  data: GeneratedImageResponseData;
}

export function GeneratedImageView({ data }: GeneratedImageViewProps) {
  return (
    <div data-responsetype="generated-image" className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{data.title}</h2>
      {data.content && <p className="text-sm text-foreground">{data.content}</p>}
      <div className="w-fit max-w-full overflow-hidden rounded-lg border border-border">
        <ImageModal
          src={data.imageUrl}
          alt={data.title}
          thumbnailClassName="block"
          imageClassName="h-auto max-w-full object-contain"
          crossOrigin="use-credentials"
        />
      </div>
    </div>
  );
}
