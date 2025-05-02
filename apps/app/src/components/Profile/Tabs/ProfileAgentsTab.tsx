import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button as UiButton } from "~/components/ui/Button";
import { FormInput } from "~/components/ui/Form/Input";
import { FormSelect } from "~/components/ui/Form/Select";
import { Label } from "~/components/ui/label";
import { useAgents } from "~/hooks/useAgents";
import { generateId } from "~/lib/utils";
import { cn } from "~/lib/utils";

import { EmptyState } from "~/components/EmptyState";
import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";

function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  agentName,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  agentName: string;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogClose onClick={onClose} />
        </DialogHeader>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {`Are you sure you want to delete the agent "${agentName}"? This action cannot be undone.`}
        </p>
        <div className="flex justify-end space-x-3 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
              </>
            ) : (
              "Delete Agent"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileAgentsTab() {
  const {
    agents,
    isLoadingAgents,
    createAgent,
    isCreatingAgent,
    deleteAgent,
    isDeletingAgent,
  } = useAgents();

  // State for create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [servers, setServers] = useState<
    Array<{ id: string; url: string; type: "sse" | "stdio" }>
  >([{ id: generateId(), url: "", type: "sse" }]);

  // State for delete confirmation
  const [agentToDelete, setAgentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setAvatarUrl("");
    setServers([{ id: generateId(), url: "", type: "sse" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (servers.some((s) => !s.url)) {
      toast.error("Please fill in all server URLs");
      return;
    }

    try {
      await createAgent({
        name,
        description,
        avatar_url: avatarUrl || null,
        servers: servers.map((s) => ({ url: s.url, type: s.type })),
      });
      toast.success("Agent created successfully");
      setModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to create agent");
      console.error(error);
    }
  };

  const handleDeleteClick = (agentId: string, agentName: string) => {
    setAgentToDelete({ id: agentId, name: agentName });
  };

  const handleConfirmDelete = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id, {
        onSuccess: () => {
          toast.success(`Agent "${agentToDelete.name}" deleted`);
          setAgentToDelete(null);
        },
        onError: (error) => {
          toast.error(
            `Failed to delete agent: ${error.message || "Unknown error"}`,
          );
          console.error("Delete error:", error);
        },
      });
    }
  };

  return (
    <div>
      <PageHeader
        actions={[
          {
            label: "Add Agent",
            onClick: () => setModalOpen(true),
            icon: <Plus className="mr-2 h-4 w-4" />,
            variant: "primary",
          },
        ]}
      >
        <PageTitle title="Agents" />
      </PageHeader>

      <div className="space-y-8">
        <Card>
          <div className="px-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Your Agents
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Manage your MCP server agents for AI integration.
            </p>
          </div>
          <div className="px-6 py-4">
            {isLoadingAgents ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                  Loading agents...
                </span>
              </div>
            ) : agents.length === 0 ? (
              <EmptyState
                message="No agents configured"
                className="bg-transparent border-none py-6 px-0"
              />
            ) : (
              <ul className="space-y-3">
                {agents.map((agent: any) => (
                  <li
                    key={agent.id}
                    className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                        {agent.name}
                      </p>
                      {agent.description && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {agent.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(agent.id, agent.name)}
                      disabled={
                        isDeletingAgent && agentToDelete?.id === agent.id
                      }
                      aria-label={`Delete agent ${agent.name}`}
                      title={`Delete agent ${agent.name}`}
                    >
                      {isDeletingAgent && agentToDelete?.id === agent.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Create Agent Modal */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && !isCreatingAgent) {
            resetForm();
          }
          setModalOpen(open);
        }}
        width="500px"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Agent</DialogTitle>
            <DialogClose onClick={() => setModalOpen(false)} />
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <FormInput
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <FormInput
              label="Avatar URL"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              type="url"
              placeholder="https://example.com/avatar.png"
              description="Optional URL to an avatar image"
            />
            <div className="space-y-2">
              <Label>Servers</Label>
              {servers.map((srv) => (
                <div key={srv.id} className="flex items-start gap-2 mb-3">
                  <FormInput
                    label="URL"
                    value={srv.url}
                    onChange={(e) => {
                      setServers((all) =>
                        all.map((s) =>
                          s.id === srv.id ? { ...s, url: e.target.value } : s,
                        ),
                      );
                    }}
                    required
                    className="flex-1"
                    placeholder="http://localhost:8080"
                    type="url"
                  />
                  <FormSelect
                    label="Type"
                    value={srv.type}
                    onChange={(e) => {
                      setServers((all) =>
                        all.map((s) =>
                          s.id === srv.id
                            ? { ...s, type: e.target.value as "sse" | "stdio" }
                            : s,
                        ),
                      );
                    }}
                    options={[
                      { value: "sse", label: "SSE" },
                      { value: "stdio", label: "Stdio" },
                    ]}
                  />
                  <UiButton
                    variant="destructive"
                    size="icon"
                    icon={<Trash2 className="h-4 w-4" />}
                    className={cn("mt-7", servers.length <= 1 && "invisible")}
                    onClick={() =>
                      setServers((all) => all.filter((s) => s.id !== srv.id))
                    }
                    disabled={servers.length <= 1}
                  />
                </div>
              ))}
              <UiButton
                type="button"
                variant="secondary"
                onClick={() =>
                  setServers((all) => [
                    ...all,
                    { id: generateId(), url: "", type: "sse" },
                  ])
                }
                className="mt-1"
                icon={<Plus className="h-4 w-4" />}
              >
                Add Server
              </UiButton>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalOpen(false)}
                disabled={isCreatingAgent}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name || isCreatingAgent}
                isLoading={isCreatingAgent}
              >
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {agentToDelete && (
        <ConfirmDeleteModal
          isOpen={!!agentToDelete}
          onClose={() => setAgentToDelete(null)}
          onConfirm={handleConfirmDelete}
          agentName={agentToDelete.name}
          isDeleting={isDeletingAgent}
        />
      )}
    </div>
  );
}
