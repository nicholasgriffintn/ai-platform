import type { CapabilitySurface, EnabledCapability } from "@ngriffin_uk/polychat-library-react";
import type {
  TeammateResponse,
  HireTeammateInput,
  ProjectCapabilityKind,
} from "@ngriffin_uk/polychat-schemas";
import { Bot, Link2, Plus, Store, UserRoundPlus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import type { TeammateCardActions, AuthoredSkillActions } from "./CapabilityGroups";
import { useTeammateCapabilityActions } from "./useTeammateCapabilityActions";

interface PendingCapabilityDeletion {
  id: string;
  kind: "teammate" | "skill";
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

export interface CapabilityAddChoice {
  description: string;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}

export interface SharedTeammateAuthoring {
  teammate: { id: string; name: string; description?: string | null } | null;
  close: () => void;
}

export interface HireTeammateAuthoring {
  open: boolean;
  setOpen: (open: boolean) => void;
  hire: (input: HireTeammateInput) => Promise<unknown>;
  isHiring: boolean;
  error: Error | null;
}

export interface CapabilityAuthoring {
  addSkill: { open: boolean; setOpen: (open: boolean) => void };
  hireTeammate: HireTeammateAuthoring;
  teammateActions: TeammateCardActions;
  browseSharedTeammates: { open: boolean; setOpen: (open: boolean) => void };
  shareTeammate: SharedTeammateAuthoring;
  attachTeammate: {
    teammates: TeammateResponse[];
    error: Error | null;
    isLoading: boolean;
    open: boolean;
    setOpen: (open: boolean) => void;
    attach: (teammateId: string) => Promise<unknown>;
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
  addChoices: CapabilityAddChoice[];
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
  const [hireTeammateOpen, setHireTeammateOpen] = useState(false);
  const [attachTeammateOpen, setAttachTeammateOpen] = useState(false);
  const [browseSharedOpen, setBrowseSharedOpen] = useState(false);
  const [sharingTeammateId, setSharingTeammateId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingCapabilityDeletion | null>(null);
  const projectId = surface.projectId;
  const canAuthor = projectId ? projectActions?.canManage === true : Boolean(currentUserId);
  const attachedTeammateIds = useMemo(
    () =>
      capabilities
        .filter((capability) => capability.kind === "teammate")
        .map((capability) => capability.capabilityId),
    [capabilities],
  );
  const teammates = useTeammateCapabilityActions(surface, attachedTeammateIds);
  const addChoices = useMemo<CapabilityAddChoice[]>(() => {
    if (!canAuthor) {
      return [];
    }

    return [
      {
        label: "Hire a teammate",
        description: "Start from a role, or describe the job in your own words",
        icon: <UserRoundPlus className="h-4 w-4" />,
        onSelect: () => setHireTeammateOpen(true),
      },
      {
        label: "Build one from scratch",
        description: "Configure a brief, its model, tools and skills yourself",
        icon: <Bot className="h-4 w-4" />,
        onSelect: () => {
          void navigate(teammates.createPath);
        },
      },
      projectId
        ? {
            label: "Attach a teammate",
            description: "Bring in a teammate this workspace already owns",
            icon: <Link2 className="h-4 w-4" />,
            onSelect: () => setAttachTeammateOpen(true),
          }
        : {
            label: "Browse shared teammates",
            description: "Install a teammate someone has published",
            icon: <Store className="h-4 w-4" />,
            onSelect: () => setBrowseSharedOpen(true),
          },
      {
        label: "Add a skill",
        description: "Upload an Teammate Skills document",
        icon: <Plus className="h-4 w-4" />,
        onSelect: () => setAddSkillOpen(true),
      },
    ];
  }, [teammates.createPath, canAuthor, navigate, projectId]);

  const isDeletingTeammate = pendingDeletion?.kind === "teammate";

  const confirmDeletion = async () => {
    if (!pendingDeletion) {
      return;
    }

    if (pendingDeletion.kind === "teammate") {
      await teammates.deleteTeammate(pendingDeletion.id);
    } else {
      await skillDeletion.delete(pendingDeletion.id);
    }

    setPendingDeletion(null);
  };

  const attachTeammateToProject = async (teammateId: string) => {
    if (!projectActions) {
      return;
    }

    await projectActions.addCapability("teammate", teammateId);
    await teammates.refreshCatalogue();
  };

  const hireTeammate = async (input: HireTeammateInput) => {
    const hired = await teammates.hireTeammate(input);

    if (projectId && projectActions) {
      await projectActions.addCapability("teammate", hired.id);
      await teammates.refreshCatalogue();
    }

    setHireTeammateOpen(false);
    void navigate(teammates.editPath(hired.id));

    return hired;
  };

  const requestDeletion = (deletion: PendingCapabilityDeletion) => {
    teammates.resetDeletion();
    skillDeletion.reset();
    setPendingDeletion(deletion);
  };

  const sharingTeammate = sharingTeammateId ? teammates.findTeammate(sharingTeammateId) : undefined;

  return {
    addSkill: { open: addSkillOpen, setOpen: setAddSkillOpen },
    hireTeammate: {
      open: hireTeammateOpen,
      setOpen: setHireTeammateOpen,
      hire: hireTeammate,
      isHiring: teammates.isHiring,
      error: teammates.hireError,
    },
    teammateActions: {
      canManage: teammates.canManageTeammate,
      canShare: teammates.canShareTeammate,
      onDelete: (id, label) => requestDeletion({ id, kind: "teammate", label }),
      onEdit: (id) => {
        void navigate(teammates.editPath(id));
      },
      onShare: setSharingTeammateId,
      pendingTeammateId: teammates.pendingTeammateId,
    },
    browseSharedTeammates: { open: browseSharedOpen, setOpen: setBrowseSharedOpen },
    shareTeammate: {
      teammate: sharingTeammate
        ? {
            id: sharingTeammate.id,
            name: sharingTeammate.name,
            description: sharingTeammate.description,
          }
        : null,
      close: () => setSharingTeammateId(null),
    },
    attachTeammate: {
      teammates: teammates.attachableTeammates,
      attach: attachTeammateToProject,
      error: projectAddError ?? null,
      isLoading: teammates.isLoadingAttachable,
      open: attachTeammateOpen,
      setOpen: setAttachTeammateOpen,
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
      error: isDeletingTeammate ? teammates.deletionError : skillDeletion.error,
      isPending: isDeletingTeammate ? teammates.isDeleting : skillDeletion.isPending,
      pending: pendingDeletion,
    },
    addChoices,
  };
}
