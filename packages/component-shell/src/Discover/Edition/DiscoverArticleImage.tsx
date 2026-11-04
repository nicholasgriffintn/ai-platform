import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useDiscoverItemImage } from "@ngriffin_uk/polychat-library-react";
import type { DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import { useObjectUrl } from "@ngriffin_uk/polychat-utility-react";
import type { ReactNode } from "react";

export function DiscoverArticleImage({
  card,
  className,
  fallback = null,
}: {
  card: DiscoverCard;
  className?: string;
  fallback?: ReactNode;
}) {
  const image = useDiscoverItemImage("imageUrl" in card && card.imageUrl ? card.id : undefined);
  const url = useObjectUrl(image.data);

  return url ? (
    <img
      src={url}
      alt=""
      decoding="async"
      className={cn("aspect-[16/9] w-full rounded-xl object-cover", className)}
    />
  ) : (
    fallback
  );
}
