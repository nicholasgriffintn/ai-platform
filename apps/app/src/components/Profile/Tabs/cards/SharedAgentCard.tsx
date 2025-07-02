import { Plus, Star } from "lucide-react";

import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/badge";

export function SharedAgentCard({ agent, onInstall, isInstalling }: any) {
  const tagsList = agent.tags ? JSON.parse(agent.tags) : [];

  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {agent.avatar_url && (
            <img
              src={agent.avatar_url || "/placeholder.svg"}
              alt={agent.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-foreground truncate">
                {agent.name}
              </h3>
            </div>

            {agent.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {agent.description}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-3">
              {agent.category && (
                <Badge variant="secondary" className="text-xs">
                  {agent.category}
                </Badge>
              )}
              {tagsList.slice(0, 3).map((tag: string) => (
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

            <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>
                  {agent.rating_average} ({agent.rating_count})
                </span>
              </div>

              {agent.author_name && (
                <div className="flex items-center gap-1.5">
                  {agent.author_avatar_url && (
                    <img
                      src={agent.author_avatar_url || "/placeholder.svg"}
                      alt={agent.author_name}
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <span className="truncate max-w-20">{agent.author_name}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <Button
                size="sm"
                variant="primary"
                onClick={() => onInstall(agent.id)}
                disabled={isInstalling}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Install
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
