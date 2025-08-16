import {
  Filter,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";

import { EmptyState } from "~/components/Core/EmptyState";
import { PageHeader } from "~/components/Core/PageHeader";
import { PageTitle } from "~/components/Core/PageTitle";
import { Button } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/Card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { FormInput } from "~/components/ui/Form/Input";
import { FormSelect } from "~/components/ui/Form/Select";
import { Switch } from "~/components/ui/Form/Switch";
import { Textarea } from "~/components/ui/Textarea";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type AgentData, useAgents } from "~/hooks/useAgents";
import { useModels } from "~/hooks/useModels";
import { useSharedAgents } from "~/hooks/useSharedAgents";
import { cn, generateId } from "~/lib/utils";
import { ConfirmDeleteModal } from "../Modals/ConfirmDeleteModal";
import { AgentCard } from "./cards/AgentCard";
import { SharedAgentCard } from "./cards/SharedAgentCard";
import { TeamCard } from "./cards/TeamCard";

interface FewShotExample {
  id: string;
  input: string;
  output: string;
}

export function ProfileAgentsTab() {
  const {
    groupedAgents,
    isLoadingAgents,
    createAgent,
    isCreatingAgent,
    updateAgent,
    isUpdatingAgent,
    deleteAgent,
    isDeletingAgent,
  } = useAgents();

  const { data: apiModels = {}, isLoading: isLoadingModels } = useModels();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.length >= 3 ? searchTerm : "");
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    sharedAgents,
    isLoadingSharedAgents,
    featuredAgents,
    isLoadingFeaturedAgents,
    installSharedAgent,
    isInstalling,
    shareAgent,
    isSharing,
    categories,
    tags,
  } = useSharedAgents({
    category: selectedCategory,
    tags: selectedTag ? [selectedTag] : [],
    search: debouncedSearchTerm,
  });

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
  const [isTeamAgent, setIsTeamAgent] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  const [agentToDelete, setAgentToDelete] = useState<AgentData | null>(null);
  const [agentToShare, setAgentToShare] = useState<AgentData | null>(null);

  // Memoize model options to prevent unnecessary recalculations
  const modelOptions = useMemo(() => {
    return Object.entries(apiModels).map(([id, model]) => ({
      value: id,
      label: model.name || id,
    }));
  }, [apiModels]);

  // Rest of the component remains exactly the same...
  const resetForm = () => {
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
    setIsTeamAgent(false);
    setTeamId("");
    setTeamRole("");
    setActiveTab("basic");
    setCurrentAgentId(null);
    setIsEditMode(false);
  };

  const handleCreateClick = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEditClick = (agent: AgentData) => {
    setCurrentAgentId(agent.id);
    setIsEditMode(true);
    setName(agent.name);
    setDescription(agent.description || "");
    setAvatarUrl(agent.avatar_url || "");
    setUseServers(Boolean(agent.servers && agent.servers.length > 0));
    setServers(
      agent.servers && agent.servers.length > 0
        ? agent.servers
        : [{ id: generateId(), url: "", type: "sse" }],
    );
    setSelectedModel(agent.model || "");
    setTemperature(agent.temperature || 0.7);
    setMaxSteps(agent.max_steps || 20);
    setSystemPrompt(agent.system_prompt || "");
    setUseFewShotExamples(
      Boolean(agent.few_shot_examples && agent.few_shot_examples.length > 0),
    );
    setFewShotExamples(
      agent.few_shot_examples && agent.few_shot_examples.length > 0
        ? agent.few_shot_examples
        : [{ id: generateId(), input: "", output: "" }],
    );
    setIsTeamAgent(Boolean(agent.team_id));
    setTeamId(agent.team_id || "");
    setTeamRole(agent.team_role || "");
    setModalOpen(true);
  };

  const handleDeleteClick = (agent: AgentData) => {
    setAgentToDelete(agent);
  };

  const handleShareClick = (agent: AgentData) => {
    setAgentToShare(agent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }

    const agentData = {
      name: name.trim(),
      description: description.trim() || undefined,
      avatar_url: avatarUrl.trim() || undefined,
      servers: useServers
        ? servers.filter((s) => s.url.trim()).length > 0
          ? servers.filter((s) => s.url.trim())
          : undefined
        : undefined,
      model: selectedModel || undefined,
      temperature,
      max_steps: maxSteps,
      system_prompt: systemPrompt.trim() || undefined,
      few_shot_examples: useFewShotExamples
        ? fewShotExamples.filter((ex) => ex.input.trim() && ex.output.trim())
            .length > 0
          ? fewShotExamples.filter(
              (ex) => ex.input.trim() && ex.output.trim(),
            )
          : undefined
        : undefined,
      team_id: isTeamAgent ? teamId.trim() || undefined : undefined,
      team_role: isTeamAgent ? teamRole || undefined : undefined,
    };

    try {
      if (isEditMode && currentAgentId) {
        await updateAgent({ id: currentAgentId, ...agentData });
        toast.success("Agent updated successfully!");
      } else {
        await createAgent(agentData);
        toast.success("Agent created successfully!");
      }
      setModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving agent:", error);
      toast.error(
        isEditMode ? "Failed to update agent" : "Failed to create agent",
      );
    }
  };

  const handleDelete = async () => {
    if (!agentToDelete) return;

    try {
      await deleteAgent(agentToDelete.id);
      toast.success("Agent deleted successfully!");
      setAgentToDelete(null);
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
    }
  };

  const handleShare = async () => {
    if (!agentToShare) return;

    try {
      await shareAgent(agentToShare.id);
      toast.success("Agent shared successfully!");
      setAgentToShare(null);
    } catch (error) {
      console.error("Error sharing agent:", error);
      toast.error("Failed to share agent");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        actions={[
          {
            label: "New Agent",
            onClick: handleCreateClick,
            icon: <Plus className="h-4 w-4" />,
            variant: "primary",
          },
        ]}
      >
        <PageTitle title="Agents" />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            My Agents
          </CardTitle>
          <CardDescription>
            Create and manage your personal AI agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Team Agents */}
              {groupedAgents.teams &&
                Object.keys(groupedAgents.teams).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                      Team Agents
                    </h3>
                    <div className="space-y-4">
                      {Object.entries(groupedAgents.teams).map(
                        ([teamId, agents]) => (
                          <TeamCard
                            key={teamId}
                            teamId={teamId}
                            agents={agents as any[]}
                            onEdit={handleEditClick}
                            onShare={handleShareClick}
                            onDelete={handleDeleteClick}
                            isUpdating={isUpdatingAgent}
                            isSharing={isSharing}
                            isDeleting={isDeletingAgent}
                            currentAgentId={currentAgentId}
                            agentToShare={agentToShare}
                            agentToDelete={agentToDelete}
                          />
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Individual Agents */}
              {groupedAgents.individual &&
                groupedAgents.individual.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                      Individual Agents
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {groupedAgents.individual.map((agent: any) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          onEdit={handleEditClick}
                          onShare={handleShareClick}
                          onDelete={handleDeleteClick}
                          isUpdating={
                            isUpdatingAgent && currentAgentId === agent.id
                          }
                          isSharing={isSharing && agentToShare?.id === agent.id}
                          isDeleting={
                            isDeletingAgent && agentToDelete?.id === agent.id
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Shared Agents
          </CardTitle>
          <CardDescription>
            Discover and install agents shared by the community
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
                <Input
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <FormSelect
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  options={[
                    { value: "", label: "All Categories" },
                    ...categories.map((cat) => ({ value: cat, label: cat })),
                  ]}
                  className="min-w-[150px]"
                />
                <FormSelect
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  options={[
                    { value: "", label: "All Tags" },
                    ...tags.map((tag) => ({ value: tag, label: tag })),
                  ]}
                  className="min-w-[120px]"
                />
              </div>
            </div>

            {/* Featured Agents */}
            {featuredAgents && featuredAgents.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Featured Agents
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {featuredAgents.map((agent: any) => (
                    <SharedAgentCard
                      key={agent.id}
                      agent={agent}
                      onInstall={() => installSharedAgent(agent.id)}
                      isInstalling={isInstalling}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Shared Agents */}
            {isLoadingSharedAgents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : sharedAgents && sharedAgents.length > 0 ? (
              <div>
                <h4 className="text-md font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Community Agents
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {sharedAgents.map((agent: any) => (
                    <SharedAgentCard
                      key={agent.id}
                      agent={agent}
                      onInstall={() => installSharedAgent(agent.id)}
                      isInstalling={isInstalling}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Filter className="h-12 w-12" />}
                title="No agents found"
                description="Try adjusting your search or filters"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && !(isCreatingAgent || isUpdatingAgent)) {
            resetForm();
          }
          setModalOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Agent" : "Create New Agent"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="model">Model</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="servers">Servers</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-6">
                <FormInput
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter agent name"
                />
                <FormInput
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent does"
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

              <TabsContent value="model" className="space-y-4 mt-6">
                {isLoadingModels ? (
                  <div className="flex items-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">
                      Loading models...
                    </span>
                  </div>
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

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={4}
                    placeholder="Enter a system prompt to customize the agent's behavior..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="team" className="space-y-4 mt-6">
                <div className="flex items-start gap-3 mb-4">
                  <Switch
                    id="is-team-agent"
                    checked={isTeamAgent}
                    onChange={(e) => setIsTeamAgent(e.target.checked)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="is-team-agent"
                      className="text-sm font-medium"
                    >
                      Team Agent
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This agent is part of a team and can collaborate with
                      other agents
                    </p>
                  </div>
                </div>

                {isTeamAgent && (
                  <div className="space-y-4 mt-4">
                    <div>
                      <FormInput
                        label="Team ID"
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                        placeholder="e.g., dev-team, marketing-team"
                        description="Unique identifier for the team this agent belongs to"
                      />
                      {groupedAgents.teams &&
                        Object.keys(groupedAgents.teams).length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-2">
                              Existing teams:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(groupedAgents.teams).map(
                                (existingTeamId) => (
                                  <button
                                    key={existingTeamId}
                                    type="button"
                                    onClick={() => setTeamId(existingTeamId)}
                                    className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-mono"
                                  >
                                    {existingTeamId}
                                  </button>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                    <FormSelect
                      label="Team Role"
                      value={teamRole}
                      onChange={(e) => setTeamRole(e.target.value)}
                      options={[
                        { value: "", label: "Select role" },
                        {
                          value: "orchestrator",
                          label: "Orchestrator (Team Lead)",
                        },
                        { value: "leader", label: "Leader" },
                        { value: "specialist", label: "Specialist" },
                        { value: "coordinator", label: "Coordinator" },
                        { value: "member", label: "Member" },
                      ]}
                      description="The role this agent plays within the team"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="servers" className="space-y-4 mt-6">
                <div className="flex items-start gap-3">
                  <Switch
                    id="use-servers"
                    checked={useServers}
                    onChange={(e) => setUseServers(e.target.checked)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="use-servers"
                      className="text-sm font-medium"
                    >
                      Use MCP Servers
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable to connect to MCP servers for additional
                      capabilities
                    </p>
                  </div>
                </div>

                {useServers && (
                  <div className="space-y-4 mt-4">
                    <Label>Servers</Label>
                    {servers.map((srv) => (
                      <div
                        key={srv.id}
                        className="flex items-end gap-3 p-4 border rounded-lg"
                      >
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
                        <Button
                          variant="destructive"
                          size="icon"
                          icon={<Trash2 className="h-4 w-4" />}
                          className={cn(servers.length <= 1 && "invisible")}
                          onClick={() =>
                            setServers((all) =>
                              all.filter((s) => s.id !== srv.id),
                            )
                          }
                          disabled={servers.length <= 1}
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setServers((all) => [
                          ...all,
                          { id: generateId(), url: "", type: "sse" },
                        ])
                      }
                      icon={<Plus className="h-4 w-4" />}
                    >
                      Add Server
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-6">
                <div className="flex items-start gap-3">
                  <Switch
                    id="use-few-shot"
                    checked={useFewShotExamples}
                    onChange={(e) => setUseFewShotExamples(e.target.checked)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="use-few-shot"
                      className="text-sm font-medium"
                    >
                      Few-Shot Examples
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Add example interactions to guide the agent's responses
                    </p>
                  </div>
                </div>

                {useFewShotExamples && (
                  <div className="space-y-4 mt-4">
                    {fewShotExamples.map((example, index) => (
                      <div
                        key={example.id}
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Example {index + 1}</h4>
                          <Button
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
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">User Input</Label>
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
                          </div>
                          <div>
                            <Label className="text-sm">Agent Response</Label>
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
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFewShotExamples((all) => [
                          ...all,
                          { id: generateId(), input: "", output: "" },
                        ])
                      }
                      icon={<Plus className="h-4 w-4" />}
                    >
                      Add Example
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <hr className="my-4" />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isCreatingAgent || isUpdatingAgent}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!name || isCreatingAgent || isUpdatingAgent}
              >
                {isCreatingAgent || isUpdatingAgent ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? "Updating..." : "Creating..."}
                  </>
                ) : isEditMode ? (
                  "Update Agent"
                ) : (
                  "Create Agent"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {agentToDelete && (
        <ConfirmDeleteModal
          isOpen={Boolean(agentToDelete)}
          onClose={() => setAgentToDelete(null)}
          onConfirm={handleDelete}
          title="Delete Agent"
          description={`Are you sure you want to delete "${agentToDelete.name}"? This action cannot be undone.`}
          isLoading={isDeletingAgent}
        />
      )}

      {/* Share Confirmation Modal */}
      {agentToShare && (
        <ConfirmDeleteModal
          isOpen={Boolean(agentToShare)}
          onClose={() => setAgentToShare(null)}
          onConfirm={handleShare}
          title="Share Agent"
          description={`Share "${agentToShare.name}" with the community? Other users will be able to install and use this agent.`}
          confirmText="Share"
          isLoading={isSharing}
        />
      )}
    </div>
  );
}
