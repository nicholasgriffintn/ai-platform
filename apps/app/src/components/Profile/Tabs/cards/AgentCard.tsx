import { Edit, Loader2, Settings, Star, Trash2, Zap } from "lucide-react";

import { Button } from "~/components/ui/Button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/badge";

export function AgentCard({
  agent,
  onEdit,
  onShare,
  onDelete,
  isUpdating,
  isSharing,
  isDeleting,
}: any) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {agent.avatar_url && (
            <img
              src={agent.avatar_url || "/placeholder.svg"}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg text-foreground truncate">
                  {agent.name}
                </h3>
                {agent.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {agent.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {agent.model && (
                <Badge variant="secondary" className="text-xs">
                  <Settings className="w-3 h-3 mr-1" />
                  {agent.model}
                </Badge>
              )}
              {agent.system_prompt && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  System Prompt
                </Badge>
              )}
              {agent.few_shot_examples && (
                <Badge variant="outline" className="text-xs">
                  Examples
                </Badge>
              )}
              {agent.servers && JSON.parse(agent.servers).length > 0 && (
                <Badge variant="outline" className="text-xs">
                  MCP Servers
                </Badge>
              )}
            </div>
          </div>
        </div>

        <hr className="my-4" />

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(agent)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Edit</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onShare(agent)}
              disabled={isSharing}
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Star className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Share</span>
            </Button>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(agent.id, agent.name)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
