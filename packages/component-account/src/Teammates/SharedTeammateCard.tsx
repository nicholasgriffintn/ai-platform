import { Badge, Button, Card } from "@ngriffin_uk/polychat-component-ui";
import type { SharedTeammateSummary } from "@ngriffin_uk/polychat-schemas";
import { parseStringArrayValue } from "@ngriffin_uk/polychat-utility-core";
import { Bot, Download, Star } from "lucide-react";

export interface SharedTeammateCardProps {
  teammate: SharedTeammateSummary;
  onInstall: (sharedTeammateId: string) => void;
  isInstalling?: boolean;
}

export function SharedTeammateCard({
  teammate,
  onInstall,
  isInstalling = false,
}: SharedTeammateCardProps) {
  const tagsList = parseStringArrayValue(teammate.tags);

  return (
    <Card className="justify-between p-5 shadow-none">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-selection">
            {teammate.avatar_url ? (
              <img
                src={teammate.avatar_url}
                alt=""
                className="h-full w-full object-cover"
                decoding="async"
                loading="lazy"
              />
            ) : (
              <Bot size={18} />
            )}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star size={13} className="fill-attention text-attention" />
            {teammate.rating_average ?? 0} ({teammate.rating_count ?? 0})
          </span>
        </div>
        <h3 className="text-lg font-bold text-foreground">{teammate.name}</h3>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
          {teammate.description}
        </p>
        {(teammate.category || tagsList.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {teammate.category && (
              <Badge variant="secondary" className="text-xs">
                {teammate.category}
              </Badge>
            )}
            {tagsList.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tagsList.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tagsList.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        {teammate.author_name ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {teammate.author_avatar_url && (
              <img
                src={teammate.author_avatar_url}
                alt=""
                className="h-4 w-4 rounded-full"
                decoding="async"
                loading="lazy"
              />
            )}
            <span className="truncate">{teammate.author_name}</span>
          </span>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          icon={<Download size={15} />}
          isLoading={isInstalling}
          disabled={isInstalling}
          onClick={() => onInstall(teammate.id)}
        >
          Install
        </Button>
      </div>
    </Card>
  );
}
