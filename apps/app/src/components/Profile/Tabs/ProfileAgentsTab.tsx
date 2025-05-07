import { Edit, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button as UiButton } from "~/components/ui/Button";
import { FormInput } from "~/components/ui/Form/Input";
import { FormSelect } from "~/components/ui/Form/Select";
import { Switch } from "~/components/ui/Form/Switch";
import { Textarea } from "~/components/ui/Textarea";
import { Label } from "~/components/ui/label";
import { type AgentData, useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

interface FewShotExample {
  id: string;
  input: string;
  output: string;
}

export function ProfileAgentsTab() {
  const {
    agents,
    isLoadingAgents,
    createAgent,
    isCreatingAgent,
    updateAgent,
    isUpdatingAgent,
    deleteAgent,
    isDeletingAgent,
  } = useAgents();

  const { data: apiModels = {}, isLoading: isLoadingModels } = useModels();

  const [modalOpen, setModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [useServers, setUseServers] = useState(false);
  const [servers, setServers] = useState<
    Array<{ id: string; url: string; type: "sse" | "stdio" }>
  >([{ id: generateId(), url: "", type: "sse" }]);

  const [selectedModel, setSelectedModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxSteps, setMaxSteps] = useState(20);
  const [systemPrompt, setSystemPrompt] = useState("");

  const [useFewShotExamples, setUseFewShotExamples] = useState(false);
  const [fewShotExamples, setFewShotExamples] = useState<FewShotExample[]>([
    { id: generateId(), input: "", output: "" },
  ]);

  const [activeTab, setActiveTab] = useState("basic");

  const [agentToDelete, setAgentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const resetForm = () => {
    setIsEditMode(false);
    setCurrentAgentId(null);
    setName("");
    setDescription("");
    setAvatarUrl("");
    setUseServers(false);
    setServers([{ id: generateId(), url: "", type: "sse" }]);
    setSelectedModel("");
    setTemperature(0.7);
    setMaxSteps(20);
    setSystemPrompt("");
    setUseFewShotExamples(false);
    setFewShotExamples([{ id: generateId(), input: "", output: "" }]);
    setActiveTab("basic");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useServers && servers.some((s) => !s.url)) {
      toast.error("Please fill in all server URLs");
      return;
    }

    if (
      useFewShotExamples &&
      fewShotExamples.some((ex) => !ex.input || !ex.output)
    ) {
      toast.error("Please fill in all few-shot example fields");
      return;
    }

    const agentData: AgentData = {
      name,
      description,
      avatar_url: avatarUrl,
      ...(useServers && {
        servers: servers.map((s) => ({ url: s.url, type: s.type })),
      }),
      ...(selectedModel && { model: selectedModel }),
      ...(temperature !== 0.7 && { temperature }),
      ...(maxSteps !== 20 && { max_steps: maxSteps }),
      ...(systemPrompt && { system_prompt: systemPrompt }),
      ...(useFewShotExamples && {
        few_shot_examples: fewShotExamples.map(({ input, output }) => ({
          input,
          output,
        })),
      }),
    };

    try {
      if (isEditMode && currentAgentId) {
        await updateAgent({
          id: currentAgentId,
          data: agentData,
        });
        toast.success("Agent updated successfully");
      } else {
        await createAgent(agentData);
        toast.success("Agent created successfully");
      }
      setModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        isEditMode ? "Failed to update agent" : "Failed to create agent",
      );
      console.error(error);
    }
  };

  const handleEditClick = (agent: any) => {
    setIsEditMode(true);
    setCurrentAgentId(agent.id);
    setName(agent.name || "");
    setDescription(agent.description || "");
    setAvatarUrl(agent.avatar_url || "");

    if (agent.servers) {
      try {
        const parsedServers = JSON.parse(agent.servers);
        if (Array.isArray(parsedServers) && parsedServers.length > 0) {
          setUseServers(true);
          setServers(
            parsedServers.map((s) => ({
              id: generateId(),
              url: s.url || "",
              type: s.type || "sse",
            })),
          );
        } else {
          setUseServers(false);
          setServers([{ id: generateId(), url: "", type: "sse" }]);
        }
      } catch (e) {
        setUseServers(false);
        setServers([{ id: generateId(), url: "", type: "sse" }]);
      }
    } else {
      setUseServers(false);
      setServers([{ id: generateId(), url: "", type: "sse" }]);
    }

    setSelectedModel(agent.model || "");

    setTemperature(
      agent.temperature ? Number.parseFloat(agent.temperature) : 0.7,
    );

    setMaxSteps(agent.max_steps || 20);

    setSystemPrompt(agent.system_prompt || "");

    if (agent.few_shot_examples) {
      try {
        const parsedExamples = JSON.parse(agent.few_shot_examples);
        if (Array.isArray(parsedExamples) && parsedExamples.length > 0) {
          setUseFewShotExamples(true);
          setFewShotExamples(
            parsedExamples.map((ex) => ({
              id: generateId(),
              input: ex.input || "",
              output: ex.output || "",
            })),
          );
        } else {
          setUseFewShotExamples(false);
          setFewShotExamples([{ id: generateId(), input: "", output: "" }]);
        }
      } catch (e) {
        setUseFewShotExamples(false);
        setFewShotExamples([{ id: generateId(), input: "", output: "" }]);
      }
    } else {
      setUseFewShotExamples(false);
      setFewShotExamples([{ id: generateId(), input: "", output: "" }]);
    }

    setModalOpen(true);
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

  const modelOptions = Object.entries(apiModels)
    .filter(([_, model]) => model.supportsFunctions)
    .map(([id, model]) => ({
      value: id,
      label: model.name || id,
    }));

  return (
    <div>
      <PageHeader
        actions={[
          {
            label: "Add Agent",
            onClick: () => {
              resetForm();
              setModalOpen(true);
            },
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
              Agents are extendable chatbots that can be used for more advanced
              conversations within Polychat. They are configured to return
              within a multi-step process and can be configured with fixed
              settings and MCP connections.
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
                    className="flex gap-4 items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-md"
                  >
                    {agent.avatar_url && (
                      <div className="flex items-center justify-center w-10 h-10">
                        <img
                          src={agent.avatar_url}
                          alt={agent.name}
                          className="w-10 h-10 rounded-full"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                        {agent.name}
                      </p>
                      {agent.description && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {agent.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {agent.model && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-400">
                            Model: {agent.model}
                          </span>
                        )}
                        {agent.system_prompt && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-400">
                            Has System Prompt
                          </span>
                        )}
                        {agent.few_shot_examples && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800/30 dark:text-purple-400">
                            Has Examples
                          </span>
                        )}
                        {agent.servers &&
                          JSON.parse(agent.servers).length > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800/30 dark:text-amber-400">
                              Has Servers
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditClick(agent)}
                        disabled={
                          isUpdatingAgent && currentAgentId === agent.id
                        }
                        aria-label={`Edit agent ${agent.name}`}
                        title={`Edit agent ${agent.name}`}
                      >
                        {isUpdatingAgent && currentAgentId === agent.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Edit className="h-4 w-4 mr-2" />
                        )}
                        Edit
                      </Button>
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
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && !(isCreatingAgent || isUpdatingAgent)) {
            resetForm();
          }
          setModalOpen(open);
        }}
        width="600px"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Agent" : "New Agent"}</DialogTitle>
            <DialogClose onClick={() => setModalOpen(false)} />
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="mb-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="model">Model Settings</TabsTrigger>
                <TabsTrigger value="servers">Servers</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
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
              </TabsContent>

              <TabsContent value="model" className="space-y-4">
                {isLoadingModels ? (
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                    Loading models...
                  </span>
                ) : (
                  <FormSelect
                    label="Model"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    options={[
                      { value: "", label: "Use chat default" },
                      ...modelOptions,
                    ]}
                    description="Select a model to use with this agent"
                    disabled={isLoadingModels}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Temperature"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(Number.parseFloat(e.target.value))
                    }
                    description="Controls randomness (0-1)"
                  />

                  <FormInput
                    label="Max Steps"
                    type="number"
                    min="1"
                    max="50"
                    step="1"
                    value={maxSteps}
                    onChange={(e) =>
                      setMaxSteps(Number.parseInt(e.target.value))
                    }
                    description="Maximum execution steps"
                  />
                </div>

                <Label htmlFor="system-prompt">System Prompt</Label>

                <Textarea
                  id="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  placeholder="Enter a system prompt to customize the agent's behavior..."
                />
              </TabsContent>

              <TabsContent value="servers" className="space-y-4">
                <div className="flex items-start gap-2">
                  <Switch
                    id="use-servers"
                    checked={useServers}
                    onChange={(e) => setUseServers(e.target.checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="use-servers"
                      className="text-sm font-medium"
                    >
                      Use MCP Servers
                    </Label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Enable to connect to MCP servers for additional
                      capabilities
                    </p>
                  </div>
                </div>

                {useServers && (
                  <div className="space-y-2 mt-4">
                    <Label>Servers</Label>
                    {servers.map((srv) => (
                      <div key={srv.id} className="flex items-start gap-2 mb-3">
                        <FormInput
                          label="URL"
                          value={srv.url}
                          onChange={(e) => {
                            setServers((all) =>
                              all.map((s) =>
                                s.id === srv.id
                                  ? { ...s, url: e.target.value }
                                  : s,
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
                                  ? {
                                      ...s,
                                      type: e.target.value as "sse" | "stdio",
                                    }
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
                          className={cn(
                            "mt-7",
                            servers.length <= 1 && "invisible",
                          )}
                          onClick={() =>
                            setServers((all) =>
                              all.filter((s) => s.id !== srv.id),
                            )
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
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="flex items-start gap-2">
                  <Switch
                    id="use-few-shot"
                    checked={useFewShotExamples}
                    onChange={(e) => setUseFewShotExamples(e.target.checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="use-few-shot"
                      className="text-sm font-medium"
                    >
                      Few-Shot Examples
                    </Label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Add example interactions to guide the agent's responses
                    </p>
                  </div>
                </div>

                {useFewShotExamples && (
                  <div className="space-y-4 mt-4">
                    {fewShotExamples.map((example, index) => (
                      <div
                        key={example.id}
                        className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-md"
                      >
                        <div className="flex justify-between mb-2">
                          <h4 className="font-medium">Example {index + 1}</h4>
                          <UiButton
                            variant="destructive"
                            size="icon"
                            icon={<Trash2 className="h-4 w-4" />}
                            className={cn(
                              fewShotExamples.length <= 1 && "invisible",
                            )}
                            onClick={() =>
                              setFewShotExamples((all) =>
                                all.filter((ex) => ex.id !== example.id),
                              )
                            }
                            disabled={fewShotExamples.length <= 1}
                          />
                        </div>

                        <Textarea
                          value={example.input}
                          onChange={(e) => {
                            setFewShotExamples((all) =>
                              all.map((ex) =>
                                ex.id === example.id
                                  ? { ...ex, input: e.target.value }
                                  : ex,
                              ),
                            );
                          }}
                          rows={2}
                          placeholder="What the user might say..."
                          required={useFewShotExamples}
                        />

                        <Textarea
                          value={example.output}
                          onChange={(e) => {
                            setFewShotExamples((all) =>
                              all.map((ex) =>
                                ex.id === example.id
                                  ? { ...ex, output: e.target.value }
                                  : ex,
                              ),
                            );
                          }}
                          rows={2}
                          placeholder="How the assistant should respond..."
                          required={useFewShotExamples}
                        />
                      </div>
                    ))}

                    <UiButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setFewShotExamples((all) => [
                          ...all,
                          { id: generateId(), input: "", output: "" },
                        ])
                      }
                      icon={<Plus className="h-4 w-4" />}
                    >
                      Add Example
                    </UiButton>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalOpen(false)}
                disabled={isCreatingAgent || isUpdatingAgent}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name || isCreatingAgent || isUpdatingAgent}
                isLoading={isCreatingAgent || isUpdatingAgent}
              >
                {isEditMode ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
