import { isModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import { useToolsStore } from "@ngriffin_uk/polychat-library-client";
import { readToolIds, type TeammateResponse } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";

import type { ChatMode } from "~/types";

type TeammateWithTools = Pick<TeammateResponse, "id" | "enabled_tools">;

const areToolsEqual = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((toolId, index) => toolId === right[index]);

export const useTeammateToolDefaults = ({
  teammates,
  selectedTeammateId,
  chatMode,
}: {
  teammates: TeammateWithTools[];
  selectedTeammateId: string | null;
  chatMode: ChatMode;
}) => {
  const { selectedTools, setSelectedTools, setToolSelectionMode, toolSelectionMode } =
    useToolsStore();
  const hadTeammateToolsRef = useRef(false);

  useEffect(() => {
    const teammate =
      chatMode === "agent" && selectedTeammateId
        ? teammates.find((candidate) => candidate.id === selectedTeammateId)
        : undefined;
    const teammateTools = teammate ? (readToolIds(teammate.enabled_tools) ?? []) : [];

    if (teammateTools.length > 0) {
      hadTeammateToolsRef.current = true;

      if (toolSelectionMode !== "explicit") {
        setToolSelectionMode("explicit");
      }

      if (!areToolsEqual(selectedTools, teammateTools)) {
        setSelectedTools(teammateTools);
      }

      return;
    }

    if (toolSelectionMode !== "managed") {
      setToolSelectionMode("managed");
    }

    if (!hadTeammateToolsRef.current) {
      return;
    }

    hadTeammateToolsRef.current = false;

    const modelTools = selectedTools.filter((toolId) => isModelToolId(toolId));

    if (!areToolsEqual(selectedTools, modelTools)) {
      setSelectedTools(modelTools);
    }
  }, [
    teammates,
    chatMode,
    selectedTeammateId,
    selectedTools,
    setSelectedTools,
    setToolSelectionMode,
    toolSelectionMode,
  ]);
};
