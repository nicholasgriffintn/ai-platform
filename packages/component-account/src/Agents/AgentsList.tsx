import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@ngriffin_uk/polychat-component-ui";
import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { Loader2, User } from "lucide-react";

import { AgentCard } from "./AgentCard";

interface AgentsListProps {
  agents: AgentResponse[];
  isLoading: boolean;
  onEdit: (agent: AgentResponse) => void;
  onShare: (agent: AgentResponse) => void;
  onDelete: (agentId: string, agentName: string) => void;
  isUpdating: boolean;
  isSharing: boolean;
  isDeleting: boolean;
  currentAgentId: string | null;
  agentToShare: { id: string; name: string } | null;
  agentToDelete: { id: string; name: string } | null;
}

export function AgentsList({
  agents,
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
            Agents are extendable chatbots that can be used for more advanced conversations within
            Polychat. They are configured to return within a multi-step process and can be
            configured with fixed settings and MCP connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading your agents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Agents
          </CardTitle>
          <CardDescription>
            Agents are extendable chatbots that can be used for more advanced conversations within
            Polychat. They are configured to return within a multi-step process and can be
            configured with fixed settings and MCP connections.
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
          Agents are extendable chatbots that can be used for more advanced conversations within
          Polychat. They are configured to return within a multi-step process and can be configured
          with fixed settings and MCP connections.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
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
      </CardContent>
    </Card>
  );
}
