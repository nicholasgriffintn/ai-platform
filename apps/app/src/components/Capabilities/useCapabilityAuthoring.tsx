import type { PageHeaderAction } from "@ngriffin_uk/polychat-component-ui";
import type { AgentResponse, ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";
import { Bot, Link2, Plus, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import type {
  AgentCardActions,
  AuthoredSkillActions,
} from "~/components/Capabilities/CapabilityGroups";
import { useAgentCapabilityActions } from "~/components/Capabilities/useAgentCapabilityActions";
import type { CapabilitySurface, EnabledCapability } from "~/lib/capability-surfaces";

interface PendingCapabilityDeletion {
  id: string;
  kind: "agent" | "skill";
  label: string;
}

export interface CapabilityAuthoringInput {
  capabilities: EnabledCapability[];
  currentUserId?: string | number;
  projectActions?: {
    addCapability: (kind: ProjectCapabilityKind, capabilityId: string) => Promise<void>;
    canManage: boolean;
  };
  projectAddError?: Error | null;
  skillDeletion: {
    delete: (skillId: string) => Promise<unknown>;
    error: Error | null;
    isPending: boolean;
    pendingSkillId?: string;
    reset: () => void;
  };
  surface: CapabilitySurface;
}

export interface SharedAgentAuthoring {
  agent: { id: string; name: string; description?: string | null } | null;
  close: () => void;
}

export interface CapabilityAuthoring {
  addSkill: { open: boolean; setOpen: (open: boolean) => void };
  agentActions: AgentCardActions;
  browseSharedAgents: { open: boolean; setOpen: (open: boolean) => void };
  shareAgent: SharedAgentAuthoring;
  attachAgent: {
    agents: AgentResponse[];
    error: Error | null;
    isLoading: boolean;
    open: boolean;
    setOpen: (open: boolean) => void;
    attach: (agentId: string) => Promise<unknown>;
  };
  authoredSkillActions: AuthoredSkillActions;
  canAuthor: boolean;
  deletion: {
    cancel: () => void;
    confirm: () => Promise<void>;
    error: Error | null;
    isPending: boolean;
    pending: PendingCapabilityDeletion | null;
  };
  headerActions?: PageHeaderAction[];
}

export function useCapabilityAuthoring({
  capabilities,
  currentUserId,
  projectActions,
  projectAddError,
  skillDeletion,
  surface,
}: CapabilityAuthoringInput): CapabilityAuthoring {
  const navigate = useNavigate();
  const [addSkillOpen, setAddSkillOpen] = useState(false);
  const [attachAgentOpen, setAttachAgentOpen] = useState(false);
  const [browseSharedOpen, setBrowseSharedOpen] = useState(false);
  const [sharingAgentId, setSharingAgentId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingCapabilityDeletion | null>(null);
  const projectId = surface.projectId;
  const canAuthor = projectId ? projectActions?.canManage === true : Boolean(currentUserId);
  const attachedAgentIds = useMemo(
    () =>
      capabilities
        .filter((capability) => capability.kind === "agent")
        .map((capability) => capability.capabilityId),
    [capabilities],
  );
  const agents = useAgentCapabilityActions(surface, attachedAgentIds);
  const headerActions = useMemo(() => {
    if (!canAuthor) {
      return undefined;
    }

    const actions: PageHeaderAction[] = [
      {
        label: "Add skill",
        icon: <Plus className="h-4 w-4" />,
        onClick: () => setAddSkillOpen(true),
      },
      {
        label: "Add agent",
        icon: <Bot className="h-4 w-4" />,
        onClick: () => {
          void navigate(agents.createPath);
        },
      },
    ];

    if (projectId) {
      actions.push({
        label: "Attach agent",
        icon: <Link2 className="h-4 w-4" />,
        onClick: () => setAttachAgentOpen(true),
      });
    } else {
      actions.push({
        label: "Browse shared agents",
        icon: <Store className="h-4 w-4" />,
        onClick: () => setBrowseSharedOpen(true),
      });
    }

    return actions;
  }, [agents.createPath, canAuthor, navigate, projectId]);

  const isDeletingAgent = pendingDeletion?.kind === "agent";

  const confirmDeletion = async () => {
    if (!pendingDeletion) {
      return;
    }

    if (pendingDeletion.kind === "agent") {
      await agents.deleteAgent(pendingDeletion.id);
    } else {
      await skillDeletion.delete(pendingDeletion.id);
    }

    setPendingDeletion(null);
  };

  const attachAgentToProject = async (agentId: string) => {
    if (!projectActions) {
      return;
    }

    await projectActions.addCapability("agent", agentId);
    await agents.refreshCatalogue();
  };

  const requestDeletion = (deletion: PendingCapabilityDeletion) => {
    agents.resetDeletion();
    skillDeletion.reset();
    setPendingDeletion(deletion);
  };

  const sharingAgent = sharingAgentId ? agents.findAgent(sharingAgentId) : undefined;

  return {
    addSkill: { open: addSkillOpen, setOpen: setAddSkillOpen },
    agentActions: {
      canManage: agents.canManageAgent,
      canShare: agents.canShareAgent,
      onDelete: (id, label) => requestDeletion({ id, kind: "agent", label }),
      onEdit: (id) => {
        void navigate(agents.editPath(id));
      },
      onShare: setSharingAgentId,
      pendingAgentId: agents.pendingAgentId,
    },
    browseSharedAgents: { open: browseSharedOpen, setOpen: setBrowseSharedOpen },
    shareAgent: {
      agent: sharingAgent
        ? {
            id: sharingAgent.id,
            name: sharingAgent.name,
            description: sharingAgent.description,
          }
        : null,
      close: () => setSharingAgentId(null),
    },
    attachAgent: {
      agents: agents.attachableAgents,
      attach: attachAgentToProject,
      error: projectAddError ?? null,
      isLoading: agents.isLoadingAttachable,
      open: attachAgentOpen,
      setOpen: setAttachAgentOpen,
    },
    authoredSkillActions: {
      canDelete: canAuthor,
      onDelete: (id, label) => requestDeletion({ id, kind: "skill", label }),
      pendingSkillId: skillDeletion.pendingSkillId,
    },
    canAuthor,
    deletion: {
      cancel: () => setPendingDeletion(null),
      confirm: confirmDeletion,
      error: isDeletingAgent ? agents.deletionError : skillDeletion.error,
      isPending: isDeletingAgent ? agents.isDeleting : skillDeletion.isPending,
      pending: pendingDeletion,
    },
    headerActions,
  };
}
