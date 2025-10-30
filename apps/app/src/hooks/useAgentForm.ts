import { useState, useCallback } from "react";
import { generateId } from "~/lib/utils";

interface FewShotExample {
  id: string;
  input: string;
  output: string;
}

interface ServerConfig {
  id: string;
  url: string;
  type: "sse" | "stdio";
}

/**
 * Hook for managing agent form state
 */
export function useAgentForm() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [useServers, setUseServers] = useState(false);
  const [servers, setServers] = useState<ServerConfig[]>([
    { id: generateId(), url: "", type: "sse" },
  ]);
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

  const resetForm = useCallback(() => {
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
  }, []);

  const loadAgentData = useCallback(
    (agent: any, apiModels: Record<string, any>) => {
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
              parsedServers.map((s: any) => ({
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
              parsedExamples.map((ex: any) => ({
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
    },
    [],
  );

  const getFormData = useCallback(() => {
    return {
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
  }, [
    name,
    description,
    avatarUrl,
    useServers,
    servers,
    selectedModel,
    temperature,
    maxSteps,
    systemPrompt,
    useFewShotExamples,
    fewShotExamples,
    isTeamAgent,
    teamId,
    teamRole,
  ]);

  const validateForm = useCallback(() => {
    if (useServers && servers.some((s) => !s.url)) {
      return { valid: false, error: "Please fill in all server URLs" };
    }

    if (
      useFewShotExamples &&
      fewShotExamples.some((ex) => !ex.input || !ex.output)
    ) {
      return {
        valid: false,
        error: "Please fill in all few-shot example fields",
      };
    }

    return { valid: true };
  }, [useServers, servers, useFewShotExamples, fewShotExamples]);

  return {
    // State
    isEditMode,
    currentAgentId,
    name,
    description,
    avatarUrl,
    useServers,
    servers,
    selectedModel,
    temperature,
    maxSteps,
    systemPrompt,
    useFewShotExamples,
    fewShotExamples,
    teamId,
    teamRole,
    isTeamAgent,
    activeTab,
    // Setters
    setName,
    setDescription,
    setAvatarUrl,
    setUseServers,
    setServers,
    setSelectedModel,
    setTemperature,
    setMaxSteps,
    setSystemPrompt,
    setUseFewShotExamples,
    setFewShotExamples,
    setTeamId,
    setTeamRole,
    setIsTeamAgent,
    setActiveTab,
    // Functions
    resetForm,
    loadAgentData,
    getFormData,
    validateForm,
  };
}
