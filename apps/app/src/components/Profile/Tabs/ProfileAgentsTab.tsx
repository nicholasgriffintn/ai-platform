import {
  Filter,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo, memo } from "react";
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

// Extract the agent form into a separate component
const AgentFormModal = memo(({
  modalOpen,
  setModalOpen,
  isEditMode,
  name,
  setName,
  description,
  setDescription,
  avatarUrl,
  setAvatarUrl,
  useServers,
  setUseServers,
  servers,
  setServers,
  selectedModel,
  setSelectedModel,
  temperature,
  setTemperature,
  maxSteps,
  setMaxSteps,
  systemPrompt,
  setSystemPrompt,
  useFewShotExamples,
  setUseFewShotExamples,
  fewShotExamples,
  setFewShotExamples,
  apiModels,
  isLoadingModels,
  isCreatingAgent,
  isUpdatingAgent,
  handleSaveAgent,
  resetForm
}: {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  isEditMode: boolean;
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (description: string) => void;
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
  useServers: boolean;
  setUseServers: (use: boolean) => void;
  servers: Array<{ id: string; url: string; type: "sse" | "stdio" }>;
  setServers: (servers: Array<{ id: string; url: string; type: "sse" | "stdio" }>) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  maxSteps: number;
  setMaxSteps: (steps: number) => void;
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  useFewShotExamples: boolean;
  setUseFewShotExamples: (use: boolean) => void;
  fewShotExamples: FewShotExample[];
  setFewShotExamples: (examples: FewShotExample[]) => void;
  apiModels: Record<string, any>;
  isLoadingModels: boolean;
  isCreatingAgent: boolean;
  isUpdatingAgent: boolean;
  handleSaveAgent: () => void;
  resetForm: () => void;
}) => {
  const addServer = useCallback(() => {
    setServers([...servers, { id: generateId(), url: "", type: "sse" }]);
  }, [servers, setServers]);

  const removeServer = useCallback((serverId: string) => {
    setServers(servers.filter((server) => server.id !== serverId));
  }, [servers, setServers]);

  const updateServer = useCallback((serverId: string, field: "url" | "type", value: string) => {
    setServers(
      servers.map((server) =>
        server.id === serverId ? { ...server, [field]: value } : server,
      ),
    );
  }, [servers, setServers]);

  const addFewShotExample = useCallback(() => {
    setFewShotExamples([
      ...fewShotExamples,
      { id: generateId(), input: "", output: "" },
    ]);
  }, [fewShotExamples, setFewShotExamples]);

  const removeFewShotExample = useCallback((exampleId: string) => {
    setFewShotExamples(
      fewShotExamples.filter((example) => example.id !== exampleId),
    );
  }, [fewShotExamples, setFewShotExamples]);

  const updateFewShotExample = useCallback((
    exampleId: string,
    field: "input" | "output",
    value: string,
  ) => {
    setFewShotExamples(
      fewShotExamples.map((example) =>
        example.id === exampleId ? { ...example, [field]: value } : example,
      ),
    );
  }, [fewShotExamples, setFewShotExamples]);

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Agent" : "Create New Agent"}
          </DialogTitle>
        </DialogHeader>
        
        {/* Form content - extract the existing form JSX here */}
        {/* This would contain all the form fields and logic */}
        
      </DialogContent>
    </Dialog>
  );
});

AgentFormModal.displayName = "AgentFormModal";

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
  const [teamId, setTeamId] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [isTeamAgent, setIsTeamAgent] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [agentToDelete, setAgentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [agentToShare, setAgentToShare] = useState<{
    id: string;
    name: string;
    description?: string;
    avatar_url?: string;
  } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [shareCategory, setShareCategory] = useState("");
  const [shareTagsInput, setShareTagsInput] = useState("");

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
    setTeamId("");
    setTeamRole("");
    setIsTeamAgent(false);
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
      ...(isTeamAgent && { is_team_agent: isTeamAgent }),
      ...(teamId && { team_id: teamId }),
      ...(teamRole && { team_role: teamRole }),
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
      } catch (_e) {
        setUseServers(false);
        setServers([{ id: generateId(), url: "", type: "sse" }]);
      }
    } else {
      setUseServers(false);
      setServers([{ id: generateId(), url: "", type: "sse" }]);
    }

    const agentModel = agent.model || "";
    const isModelAvailable =
      agentModel === "" || apiModels[agentModel]?.supportsToolCalls;

    setSelectedModel(isModelAvailable ? agentModel : "");
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
      } catch (_e) {
        setUseFewShotExamples(false);
        setFewShotExamples([{ id: generateId(), input: "", output: "" }]);
      }
    } else {
      setUseFewShotExamples(false);
      setFewShotExamples([{ id: generateId(), input: "", output: "" }]);
    }

    setTeamId(agent.team_id || "");
    setTeamRole(agent.team_role || "");
    setIsTeamAgent(agent.is_team_agent || false);

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

  const handleShareClick = (agent: any) => {
    setAgentToShare(agent);
    setShareName(agent.name || "");
    setShareDescription(agent.description || "");
    setShareCategory("");
    setShareTagsInput("");
    setShareModalOpen(true);
  };

  const handleConfirmShare = async () => {
    if (agentToShare) {
      const tagsArray = shareTagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      await shareAgent({
        agentId: agentToShare.id,
        name: shareName,
        description: shareDescription || undefined,
        avatarUrl: agentToShare.avatar_url || undefined,
        category: shareCategory || undefined,
        tags: tagsArray,
      });
      setShareModalOpen(false);
      setAgentToShare(null);
    }
  };

  const modelOptions = Object.entries(apiModels)
    .filter(([_, model]) => model.supportsToolCalls)
    .map(([id, model]) => ({
      value: id,
      label: model.name || id,
    }));

  // Memoize filtered agents to avoid recalculation
  const filteredAgents = useMemo(() => {
    // Add filtering logic here if needed
    return groupedAgents;
  }, [groupedAgents]);

  return (
    <div className="space-y-8">
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
          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Loading your agents...
              </span>
            </div>
          ) : !groupedAgents.teams &&
            (!groupedAgents.individual ||
              groupedAgents.individual.length === 0) ? (
            <EmptyState
              title="No Agents Yet"
              message="Create your first agent to get started with advanced AI conversations"
              icon={<User className="h-5 w-5" />}
            />
          ) : (
            <div className="space-y-6">
              {/* Team Agents */}
              {groupedAgents.teams &&
                Object.values(groupedAgents.teams).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                      Agent Teams
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Object.values(groupedAgents.teams).map((team: any) => (
                        <TeamCard
                          key={team.id}
                          team={team}
                          onEdit={handleEditClick}
                          onShare={handleShareClick}
                          onDelete={handleDeleteClick}
                          isUpdating={
                            isUpdatingAgent &&
                            currentAgentId === team.orchestrator?.id
                          }
                          isSharing={
                            isSharing &&
                            agentToShare?.id === team.orchestrator?.id
                          }
                          isDeleting={
                            isDeletingAgent &&
                            agentToDelete?.id === team.orchestrator?.id
                          }
                        />
                      ))}
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
            <Search className="h-5 w-5" />
            Browse Agents
          </CardTitle>
          <CardDescription>
            Search and filter community-shared agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingFeaturedAgents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Loading featured agents...
              </span>
            </div>
          ) : featuredAgents.length === 0 ? (
            <EmptyState
              title="No Featured Agents"
              message="Check back later for featured agents from the community"
              icon={<Star className="h-5 w-5 text-yellow-500" />}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Featured
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {featuredAgents.map((agent: any) => (
                    <SharedAgentCard
                      key={agent.id}
                      agent={agent}
                      onInstall={installSharedAgent}
                      isInstalling={isInstalling}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or description..."
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
                  { value: "", label: "All categories" },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
                className="min-w-40"
              />
              <FormSelect
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                options={[
                  { value: "", label: "All tags" },
                  ...tags.map((t) => ({ value: t, label: t })),
                ]}
                className="min-w-32"
              />
            </div>
          </div>

          {isLoadingSharedAgents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Searching agents...
              </span>
            </div>
          ) : sharedAgents.length === 0 ? (
            <EmptyState
              title="No Agents Found"
              message="Try adjusting your search terms or filters to find more agents"
              icon={<Filter className="h-5 w-5" />}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedAgents.map((agent: any) => (
                <SharedAgentCard
                  key={agent.id}
                  agent={agent}
                  onInstall={installSharedAgent}
                  isInstalling={isInstalling}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AgentFormModal
        modalOpen={modalOpen}
        setModalOpen={setModalOpen}
        isEditMode={isEditMode}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        avatarUrl={avatarUrl}
        setAvatarUrl={setAvatarUrl}
        useServers={useServers}
        setUseServers={setUseServers}
        servers={servers}
        setServers={setServers}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        temperature={temperature}
        setTemperature={setTemperature}
        maxSteps={maxSteps}
        setMaxSteps={setMaxSteps}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        useFewShotExamples={useFewShotExamples}
        setUseFewShotExamples={setUseFewShotExamples}
        fewShotExamples={fewShotExamples}
        setFewShotExamples={setFewShotExamples}
        apiModels={apiModels}
        isLoadingModels={isLoadingModels}
        isCreatingAgent={isCreatingAgent}
        isUpdatingAgent={isUpdatingAgent}
        handleSaveAgent={handleSubmit}
        resetForm={resetForm}
      />
      
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

      {/* Share Agent Modal */}
      {shareModalOpen && agentToShare && (
        <Dialog
          open={shareModalOpen}
          onOpenChange={(open) => {
            if (!open) setShareModalOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share Agent</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <FormInput
                label="Name"
                value={shareName}
                onChange={(e) => setShareName(e.target.value)}
                required
              />
              <FormInput
                label="Description"
                value={shareDescription}
                onChange={(e) => setShareDescription(e.target.value)}
              />
              <FormSelect
                label="Category"
                value={shareCategory}
                onChange={(e) => setShareCategory(e.target.value)}
                options={[
                  { value: "", label: "Select category" },
                  ...categories.map((c) => ({ value: c, label: c })),
                ]}
              />
              <FormInput
                label="Tags (comma separated)"
                value={shareTagsInput}
                onChange={(e) => setShareTagsInput(e.target.value)}
                placeholder="writing, assistant, productivity"
              />

              <hr className="my-4" />

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShareModalOpen(false)}
                  disabled={isSharing}
                >
                  Cancel
                </Button>
                <Button onClick={handleConfirmShare} disabled={isSharing}>
                  {isSharing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    "Share Agent"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
