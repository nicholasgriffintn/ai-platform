import { Button, Card, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRightLeft, Clock3, Link2, ShieldCheck, Trash2 } from "lucide-react";

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMemberSummary {
  userId: number;
  email: string;
  name?: string | null;
  role: WorkspaceRole;
}

export interface WorkspaceInvitationSummary {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
}

export interface WorkspaceMemberListProps {
  members: WorkspaceMemberSummary[];
  /** The viewer's own role, which decides who they may re-role, remove, or promote. */
  viewerRole: WorkspaceRole;
  viewerUserId?: number;
  onChangeRole: (userId: number, role: "admin" | "member") => void;
  onRemove: (userId: number) => void;
  onTransferOwnership: (userId: number) => void;
}

function canManageMember(
  member: WorkspaceMemberSummary,
  viewerRole: WorkspaceRole,
  viewerUserId?: number,
) {
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  return (
    canManage &&
    member.role !== "owner" &&
    viewerUserId !== member.userId &&
    !(viewerRole === "admin" && member.role === "admin")
  );
}

export function WorkspaceMemberList({
  members,
  viewerRole,
  viewerUserId,
  onChangeRole,
  onRemove,
  onTransferOwnership,
}: WorkspaceMemberListProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      {members.map((member) => {
        const isManageable = canManageMember(member, viewerRole, viewerUserId);

        return (
          <div
            key={member.userId}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-sm font-semibold">
              {(member.name || member.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{member.name || member.email}</p>
              {member.name && (
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              )}
            </div>
            {isManageable ? (
              <FormSelect
                aria-label={`Role for ${member.name || member.email}`}
                fullWidth={false}
                value={member.role}
                onChange={(event) =>
                  onChangeRole(member.userId, event.target.value as "admin" | "member")
                }
                className="w-28 capitalize"
              >
                <option value="member">Member</option>
                {viewerRole === "owner" ? <option value="admin">Admin</option> : null}
              </FormSelect>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs capitalize text-muted-foreground">
                {member.role === "owner" && <ShieldCheck size={13} />}
                {member.role}
              </span>
            )}
            {isManageable ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={14} />}
                onClick={() => onRemove(member.userId)}
              >
                Remove
              </Button>
            ) : null}
            {viewerRole === "owner" && member.role !== "owner" ? (
              <Button
                size="sm"
                variant="outline"
                icon={<ArrowRightLeft size={14} />}
                onClick={() => onTransferOwnership(member.userId)}
              >
                Make owner
              </Button>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}

export interface WorkspaceInvitationListProps {
  invitations: WorkspaceInvitationSummary[];
  revokingInvitationId?: string | null;
  onRevoke: (invitationId: string) => void;
}

export function WorkspaceInvitationList({
  invitations,
  revokingInvitationId,
  onRevoke,
}: WorkspaceInvitationListProps) {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-semibold">Pending invitations</h2>
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        {invitations.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <Link2 size={17} className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{invite.email}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 size={12} /> Expires {new Date(invite.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <span className="text-xs capitalize text-muted-foreground">{invite.role}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={<Trash2 size={14} />}
              isLoading={revokingInvitationId === invite.id}
              onClick={() => onRevoke(invite.id)}
            >
              Revoke
            </Button>
          </div>
        ))}
      </Card>
    </section>
  );
}
