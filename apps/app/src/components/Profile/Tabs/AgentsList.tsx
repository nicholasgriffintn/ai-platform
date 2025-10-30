import { Loader2, User } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { AgentCard } from "./cards/AgentCard";
import { TeamCard } from "./cards/TeamCard";

interface AgentsListProps {
  groupedAgents: any;
  isLoading: boolean;
  onEdit: (agent: any) => void;
  onShare: (agent: any) => void;
  onDelete: (agentId: string, agentName: string) => void;
  isUpdating: boolean;
  isSharing: boolean;
  isDeleting: boolean;
  currentAgentId: string | null;
  agentToShare: { id: string; name: string } | null;
  agentToDelete: { id: string; name: string } | null;
}

export function AgentsList({
  groupedAgents,
  isLoading,
  onEdit,
  onShare,
  onDelete,
  isUpdating,
  isSharing,
  isDeleting,
  currentAgentId,
  agentToShare,
  agentToDelete,
}: AgentsListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Agents
          </CardTitle>
          <CardDescription>
            Agents are extendable chatbots that can be used for more advanced
            conversations within Polychat. They are configured to return within
            a multi-step process and can be configured with fixed settings and
            MCP connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">
              Loading your agents...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasTeams =
    groupedAgents.teams && Object.values(groupedAgents.teams).length > 0;
  const hasIndividual =
    groupedAgents.individual && groupedAgents.individual.length > 0;

  if (!hasTeams && !hasIndividual) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Agents
          </CardTitle>
          <CardDescription>
            Agents are extendable chatbots that can be used for more advanced
            conversations within Polychat. They are configured to return within
            a multi-step process and can be configured with fixed settings and
            MCP connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No Agents Yet"
            message="Create your first agent to get started with advanced AI conversations"
            icon={<User className="h-5 w-5" />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Your Agents
        </CardTitle>
        <CardDescription>
          Agents are extendable chatbots that can be used for more advanced
          conversations within Polychat. They are configured to return within a
          multi-step process and can be configured with fixed settings and MCP
          connections.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Team Agents */}
          {hasTeams && (
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Agent Teams
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.values(groupedAgents.teams).map((team: any) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onEdit={onEdit}
                    onShare={onShare}
                    onDelete={onDelete}
                    isUpdating={
                      isUpdating && currentAgentId === team.orchestrator?.id
                    }
                    isSharing={
                      isSharing && agentToShare?.id === team.orchestrator?.id
                    }
                    isDeleting={
                      isDeleting && agentToDelete?.id === team.orchestrator?.id
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Individual Agents */}
          {hasIndividual && (
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Individual Agents
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groupedAgents.individual.map((agent: any) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={onEdit}
                    onShare={onShare}
                    onDelete={onDelete}
                    isUpdating={isUpdating && currentAgentId === agent.id}
                    isSharing={isSharing && agentToShare?.id === agent.id}
                    isDeleting={isDeleting && agentToDelete?.id === agent.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
