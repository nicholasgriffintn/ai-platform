import { Button, Card, CardContent, Badge } from "@ngriffin_uk/polychat-component-ui";
import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { Edit, Loader2, Settings, Star, Trash2, Zap } from "lucide-react";

export interface AgentCardProps {
  agent: AgentResponse;
  onEdit: (agent: AgentResponse) => void;
  onShare: (agent: AgentResponse) => void;
  onDelete: (agentId: string, agentName: string) => void;
  isUpdating?: boolean;
  isSharing?: boolean;
  isDeleting?: boolean;
}

export function AgentCard({
  agent,
  onEdit,
  onShare,
  onDelete,
  isUpdating = false,
  isSharing = false,
  isDeleting = false,
}: AgentCardProps) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {agent.avatar_url && (
            <img
              src={agent.avatar_url || "/placeholder.svg"}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover"
              decoding="async"
              loading="lazy"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-lg text-foreground truncate">{agent.name}</h3>
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
              {agent.few_shot_examples && agent.few_shot_examples.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Examples
                </Badge>
              )}
              {agent.servers.length > 0 && (
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
              collapseLabel
              onClick={() => onEdit(agent)}
              disabled={isUpdating}
              aria-label="Edit"
              title="Edit"
              icon={
                isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Edit className="h-4 w-4" />
                )
              }
            >
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              collapseLabel
              onClick={() => onShare(agent)}
              disabled={isSharing}
              aria-label="Share"
              title="Share"
              icon={
                isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star className="h-4 w-4" />
                )
              }
            >
              Share
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
