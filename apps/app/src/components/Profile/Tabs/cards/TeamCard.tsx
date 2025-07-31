import {
  ChevronDown,
  ChevronRight,
  Edit,
  MoreHorizontal,
  Share,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import { DropdownMenu, DropdownMenuItem } from "~/components/ui/DropdownMenu";
import { cn } from "~/lib/utils";

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    orchestrator: any;
    members: any[];
  };
  onEdit: (agent: any) => void;
  onShare: (agent: any) => void;
  onDelete: (agentId: string, agentName: string) => void;
  isUpdating?: boolean;
  isSharing?: boolean;
  isDeleting?: boolean;
}

export function TeamCard({
  team,
  onEdit,
  onShare,
  onDelete,
  isUpdating = false,
  isSharing = false,
  isDeleting = false,
}: TeamCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<
    Record<string, boolean>
  >({});
  const { orchestrator, members } = team;

  if (!orchestrator) {
    return null;
  }

  const totalMembers = members.length + 1; // +1 for orchestrator

  const toggleDescription = (agentId: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const renderDescription = (agent: any) => {
    if (!agent.description) return null;

    const isExpanded = expandedDescriptions[agent.id];
    const shouldTruncate = agent.description.length > 100;
    const displayText =
      shouldTruncate && !isExpanded
        ? `${agent.description.slice(0, 100)}...`
        : agent.description;

    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        {displayText}
        {shouldTruncate && (
          <button
            type="button"
            onClick={() => toggleDescription(agent.id)}
            className="ml-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    );
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {team.name}
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 space-y-1">
                <div>
                  Team with {totalMembers} members • Led by {orchestrator.name}
                </div>
                <div className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded inline-block">
                  Team ID: {team.id}
                </div>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu
              trigger={<MoreHorizontal className="h-4 w-4" />}
              buttonProps={{
                variant: "ghost",
                size: "sm",
                className: "h-8 w-8 p-0",
                disabled: isUpdating || isSharing || isDeleting,
              }}
            >
              <DropdownMenuItem
                onClick={() => onEdit(orchestrator)}
                icon={<Edit className="h-4 w-4" />}
              >
                Edit Team Leader
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onShare(orchestrator)}
                icon={<Share className="h-4 w-4" />}
              >
                Share Team
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(orchestrator.id, team.name)}
                className="text-red-600 dark:text-red-400"
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete Team
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Team Members:
            </div>

            {/* Orchestrator */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                {orchestrator.avatar_url ? (
                  <img
                    src={orchestrator.avatar_url}
                    alt={orchestrator.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {orchestrator.name}
                  <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                    Team Lead
                  </span>
                </div>
                {renderDescription(orchestrator)}
              </div>
              <DropdownMenu
                trigger={<MoreHorizontal className="h-4 w-4" />}
                buttonProps={{
                  variant: "ghost",
                  size: "sm",
                  className: "h-6 w-6 p-0",
                  disabled: isUpdating || isSharing || isDeleting,
                }}
              >
                <DropdownMenuItem
                  onClick={() => onEdit(orchestrator)}
                  icon={<Edit className="h-4 w-4" />}
                >
                  Edit Team Lead
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onShare(orchestrator)}
                  icon={<Share className="h-4 w-4" />}
                >
                  Share Team Lead
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(orchestrator.id, orchestrator.name)}
                  className="text-red-600 dark:text-red-400"
                  icon={<Trash2 className="h-4 w-4" />}
                >
                  Delete Team Lead
                </DropdownMenuItem>
              </DropdownMenu>
            </div>

            {/* Team Members */}
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"
              >
                <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <Users className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {member.name}
                    <span
                      className={cn(
                        "ml-2 text-xs px-2 py-0.5 rounded",
                        member.team_role === "specialist" &&
                          "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
                        member.team_role === "coordinator" &&
                          "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
                        member.team_role === "member" &&
                          "bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400",
                        member.team_role === "leader" &&
                          "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
                      )}
                    >
                      {member.team_role?.charAt(0).toUpperCase() +
                        member.team_role?.slice(1) || "Member"}
                    </span>
                  </div>
                  {renderDescription(member)}
                </div>
                <DropdownMenu
                  trigger={<MoreHorizontal className="h-4 w-4" />}
                  buttonProps={{
                    variant: "ghost",
                    size: "sm",
                    className: "h-6 w-6 p-0",
                    disabled: isUpdating || isSharing || isDeleting,
                  }}
                >
                  <DropdownMenuItem
                    onClick={() => onEdit(member)}
                    icon={<Edit className="h-4 w-4" />}
                  >
                    Edit Member
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onShare(member)}
                    icon={<Share className="h-4 w-4" />}
                  >
                    Share Member
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(member.id, member.name)}
                    className="text-red-600 dark:text-red-400"
                    icon={<Trash2 className="h-4 w-4" />}
                  >
                    Delete Member
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
