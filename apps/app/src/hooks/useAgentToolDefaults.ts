import { isModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import { readToolIds } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

import { useToolsStore } from "~/state/stores/toolsStore";
import type { ChatMode } from "~/types";

type AgentWithTools = {
  id: string;
  enabled_tools?: string[] | string | null;
};

const areToolsEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((toolId, index) => toolId === right[index]);

/**
 * An agent that names its own tools is a configuration, so its selection is sent as-is instead of
 * being topped up by the server's managed baseline. Leaving that agent hands the choice back to
 * the server and keeps only the hosted model toggles the person set themselves.
 */
export const useAgentToolDefaults = ({
  agents,
  selectedAgentId,
  chatMode,
}: {
  agents: AgentWithTools[];
  selectedAgentId: string | null;
  chatMode: ChatMode;
}) => {
  const { selectedTools, setSelectedTools, setToolSelectionMode, toolSelectionMode } =
    useToolsStore();
  const hadAgentToolsRef = useRef(false);

  useEffect(() => {
    const agent =
      chatMode === "agent" && selectedAgentId
        ? agents.find((candidate) => candidate.id === selectedAgentId)
        : undefined;
    const agentTools = agent ? (readToolIds(agent.enabled_tools) ?? []) : [];

    if (agentTools.length > 0) {
      hadAgentToolsRef.current = true;

      if (toolSelectionMode !== "explicit") {
        setToolSelectionMode("explicit");
      }

      if (!areToolsEqual(selectedTools, agentTools)) {
        setSelectedTools(agentTools);
      }

      return;
    }

    if (toolSelectionMode !== "managed") {
      setToolSelectionMode("managed");
    }

    if (!hadAgentToolsRef.current) {
      return;
    }

    hadAgentToolsRef.current = false;

    const modelTools = selectedTools.filter((toolId) => isModelToolId(toolId));

    if (!areToolsEqual(selectedTools, modelTools)) {
      setSelectedTools(modelTools);
    }
  }, [
    agents,
    chatMode,
    selectedAgentId,
    selectedTools,
    setSelectedTools,
    setToolSelectionMode,
    toolSelectionMode,
  ]);
};
