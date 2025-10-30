import { Loader2, Plus, Trash2 } from "lucide-react";
import React, { type FormEvent } from "react";

import { Button } from "~/components/ui/Button";
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
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useAgentForm } from "~/hooks/useAgentForm";
import { cn, generateId } from "~/lib/utils";

interface AgentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    data: any,
    isEdit: boolean,
    agentId: string | null,
  ) => Promise<void>;
  isSubmitting: boolean;
  apiModels: Record<string, any>;
  groupedAgents: any;
  agent?: any; // When editing
}

export function AgentFormModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  apiModels,
  groupedAgents,
  agent,
}: AgentFormModalProps) {
  const form = useAgentForm();

  // Load agent data when editing
  React.useEffect(() => {
    if (agent && open) {
      form.loadAgentData(agent, apiModels);
    } else if (open && !agent) {
      form.resetForm();
    }
  }, [agent, open, apiModels]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validation = form.validateForm();
    if (!validation.valid) {
      return;
    }

    const formData = form.getFormData();
    await onSubmit(formData, form.isEditMode, form.currentAgentId);
  };

  const modelOptions = Object.entries(apiModels)
    .filter(([_, model]) => model.supportsToolCalls)
    .map(([id, model]) => ({
      value: id,
      label: model.name || id,
    }));

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isSubmitting) {
          form.resetForm();
        }
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {form.isEditMode ? "Edit Agent" : "Create New Agent"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs
            value={form.activeTab}
            onValueChange={form.setActiveTab}
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
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                required
                placeholder="Enter agent name"
              />
              <FormInput
                label="Description"
                value={form.description}
                onChange={(e) => form.setDescription(e.target.value)}
                placeholder="Describe what this agent does"
              />
              <FormInput
                label="Avatar URL"
                value={form.avatarUrl}
                onChange={(e) => form.setAvatarUrl(e.target.value)}
                type="url"
                placeholder="https://example.com/avatar.png"
                description="Optional URL to an avatar image"
              />
            </TabsContent>

            <TabsContent value="model" className="space-y-4 mt-6">
              <FormSelect
                label="Model"
                value={form.selectedModel}
                onChange={(e) => form.setSelectedModel(e.target.value)}
                options={[
                  { value: "", label: "Use chat default" },
                  ...modelOptions,
                ]}
                description="Select a model to use with this agent"
              />

              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Temperature"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) =>
                    form.setTemperature(Number.parseFloat(e.target.value))
                  }
                  description="Controls randomness (0-1)"
                />
                <FormInput
                  label="Max Steps"
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={form.maxSteps}
                  onChange={(e) =>
                    form.setMaxSteps(Number.parseInt(e.target.value))
                  }
                  description="Maximum execution steps"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  value={form.systemPrompt}
                  onChange={(e) => form.setSystemPrompt(e.target.value)}
                  rows={4}
                  placeholder="Enter a system prompt to customize the agent's behavior..."
                />
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4 mt-6">
              <div className="flex items-start gap-3 mb-4">
                <Switch
                  id="is-team-agent"
                  checked={form.isTeamAgent}
                  onChange={(e) => form.setIsTeamAgent(e.target.checked)}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="is-team-agent"
                    className="text-sm font-medium"
                  >
                    Team Agent
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This agent is part of a team and can collaborate with other
                    agents
                  </p>
                </div>
              </div>

              {form.isTeamAgent && (
                <div className="space-y-4 mt-4">
                  <div>
                    <FormInput
                      label="Team ID"
                      value={form.teamId}
                      onChange={(e) => form.setTeamId(e.target.value)}
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
                                  onClick={() => form.setTeamId(existingTeamId)}
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
                    value={form.teamRole}
                    onChange={(e) => form.setTeamRole(e.target.value)}
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
                  checked={form.useServers}
                  onChange={(e) => form.setUseServers(e.target.checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="use-servers" className="text-sm font-medium">
                    Use MCP Servers
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Enable to connect to MCP servers for additional capabilities
                  </p>
                </div>
              </div>

              {form.useServers && (
                <div className="space-y-4 mt-4">
                  <Label>Servers</Label>
                  {form.servers.map((srv) => (
                    <div
                      key={srv.id}
                      className="flex items-end gap-3 p-4 border rounded-lg"
                    >
                      <FormInput
                        label="URL"
                        value={srv.url}
                        onChange={(e) => {
                          form.setServers((all) =>
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
                          form.setServers((all) =>
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
                        className={cn(form.servers.length <= 1 && "invisible")}
                        onClick={() =>
                          form.setServers((all) =>
                            all.filter((s) => s.id !== srv.id),
                          )
                        }
                        disabled={form.servers.length <= 1}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setServers((all) => [
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
                  checked={form.useFewShotExamples}
                  onChange={(e) => form.setUseFewShotExamples(e.target.checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="use-few-shot" className="text-sm font-medium">
                    Few-Shot Examples
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add example interactions to guide the agent's responses
                  </p>
                </div>
              </div>

              {form.useFewShotExamples && (
                <div className="space-y-4 mt-4">
                  {form.fewShotExamples.map((example, index) => (
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
                            form.fewShotExamples.length <= 1 && "invisible",
                          )}
                          onClick={() =>
                            form.setFewShotExamples((all) =>
                              all.filter((ex) => ex.id !== example.id),
                            )
                          }
                          disabled={form.fewShotExamples.length <= 1}
                        />
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm">User Input</Label>
                          <Textarea
                            value={example.input}
                            onChange={(e) => {
                              form.setFewShotExamples((all) =>
                                all.map((ex) =>
                                  ex.id === example.id
                                    ? { ...ex, input: e.target.value }
                                    : ex,
                                ),
                              );
                            }}
                            rows={2}
                            placeholder="What the user might say..."
                            required={form.useFewShotExamples}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Agent Response</Label>
                          <Textarea
                            value={example.output}
                            onChange={(e) => {
                              form.setFewShotExamples((all) =>
                                all.map((ex) =>
                                  ex.id === example.id
                                    ? { ...ex, output: e.target.value }
                                    : ex,
                                ),
                              );
                            }}
                            rows={2}
                            placeholder="How the assistant should respond..."
                            required={form.useFewShotExamples}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      form.setFewShotExamples((all) => [
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
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!form.name || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {form.isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : form.isEditMode ? (
                "Update Agent"
              ) : (
                "Create Agent"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
