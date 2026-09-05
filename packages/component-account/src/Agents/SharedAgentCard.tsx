import { Badge, Button, Card } from "@ngriffin_uk/polychat-component-ui";
import type { SharedAgentSummary } from "@ngriffin_uk/polychat-schemas";
import { parseStringArrayValue } from "@ngriffin_uk/polychat-utility-core";
import { Bot, Download, Star } from "lucide-react";

export interface SharedAgentCardProps {
  agent: SharedAgentSummary;
  onInstall: (sharedAgentId: string) => void;
  isInstalling?: boolean;
}

export function SharedAgentCard({ agent, onInstall, isInstalling = false }: SharedAgentCardProps) {
  const tagsList = parseStringArrayValue(agent.tags);

  return (
    <Card className="justify-between p-5 shadow-none">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="bg-selection flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
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
            {agent.rating_average ?? 0} ({agent.rating_count ?? 0})
          </span>
        </div>
        <h3 className="text-foreground text-lg font-bold">{agent.name}</h3>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{agent.description}</p>
        {(agent.category || tagsList.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.category && (
              <Badge variant="secondary" className="text-xs">
                {agent.category}
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
        {agent.author_name ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {agent.author_avatar_url && (
              <img
                src={agent.author_avatar_url}
                alt=""
                className="h-4 w-4 rounded-full"
                decoding="async"
                loading="lazy"
              />
            )}
            <span className="truncate">{agent.author_name}</span>
          </span>
        ) : (
          <span />
        )}
        <Button
          variant="primary"
          icon={<Download size={15} />}
          isLoading={isInstalling}
          disabled={isInstalling}
          onClick={() => onInstall(agent.id)}
        >
          Install
        </Button>
      </div>
    </Card>
  );
}
