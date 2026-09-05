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
      <div className="overflow-hidden rounded-lg border border-border">
        <ImageModal
          src={data.imageUrl}
          alt={data.title}
          thumbnailClassName="block w-full"
          imageClassName="h-auto w-full rounded-lg object-contain"
          crossOrigin="use-credentials"
        />
      </div>
    </div>
  );
}
