import {
  StrudelStudio,
  defaultCode,
  examplePatterns,
  type PatternExample,
} from "@ngriffin_uk/polychat-component-experiences/music";
import { EMPTY_MODEL_CONFIG, getAvailableModels } from "@ngriffin_uk/polychat-schemas";
import type { StrudelComplexity, StrudelStyle } from "@ngriffin_uk/polychat-schemas";
import { parseCommaSeparatedTags } from "@ngriffin_uk/polychat-utility-core";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useModels } from "~/hooks/useModels";
import { useGenerateStrudelPattern, useSaveStrudelPattern } from "~/hooks/useStrudel";

interface StrudelCreateStudioProps {
  basePath: string;
  projectId?: string;
}

export function StrudelCreateStudio({ basePath, projectId }: StrudelCreateStudioProps) {
  const navigate = useNavigate();
  const generateMutation = useGenerateStrudelPattern(projectId);
  const saveMutation = useSaveStrudelPattern(projectId);
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<"" | StrudelStyle>("");
  const [complexity, setComplexity] = useState<StrudelComplexity>("medium");
  const [tempo, setTempo] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [code, setCode] = useState(defaultCode);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  const parsedTags = useMemo(() => parseCommaSeparatedTags(tagsInput), [tagsInput]);

  const textModels = useMemo(() => {
    const availableModels = getAvailableModels(apiModels, false);

    return Object.entries(availableModels)
      .filter(([, model]) => {
        const inputs = model.modalities?.input ?? ["text"];
        const outputs = model.modalities?.output ?? inputs;
        const supportsOnlyText =
          outputs.length === 1 && outputs[0] === "text" && inputs.includes("text");

        return supportsOnlyText;
      })
      .map(([id, model]) => ({
        value: id,
        label: model.name || id,
        provider: model.provider,
      }));
  }, [apiModels]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Describe what you want to hear first");

      return;
    }

    try {
      const payload = await generateMutation.mutateAsync({
        prompt: prompt.trim(),
        style: style || undefined,
        complexity,
        tempo: tempo ? Number(tempo) : undefined,
        model: selectedModel || undefined,
      });

      setCode(payload.code);
      if (!name.trim()) {
        setName(prompt.slice(0, 64));
      }

      toast.success("Generated a new Strudel pattern");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to generate pattern");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Give your pattern a name");

      return;
    }

    try {
      const pattern = await saveMutation.mutateAsync({
        name: name.trim(),
        code,
        description: description.trim() || undefined,
        tags: parsedTags,
      });

      toast.success("Pattern saved");
      void navigate(`${basePath}/${pattern.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save pattern");
    }
  };

  const handleLoadExample = (example: PatternExample) => {
    setSelectedExampleId(example.id);
    setCode(example.code);
    if (!name.trim()) {
      setName(example.name);
    }

    toast.success(`Loaded ${example.name}`);
  };

  return (
    <StrudelStudio
      prompt={prompt}
      onPromptChange={setPrompt}
      style={style}
      onStyleChange={setStyle}
      complexity={complexity}
      onComplexityChange={setComplexity}
      tempo={tempo}
      onTempoChange={setTempo}
      selectedModel={selectedModel}
      onSelectedModelChange={setSelectedModel}
      textModels={textModels}
      code={code}
      onCodeChange={setCode}
      name={name}
      onNameChange={setName}
      description={description}
      onDescriptionChange={setDescription}
      tagsInput={tagsInput}
      onTagsInputChange={setTagsInput}
      parsedTags={parsedTags}
      examples={examplePatterns}
      selectedExampleId={selectedExampleId}
      onSelectExample={handleLoadExample}
      isGenerating={generateMutation.isPending}
      isSaving={saveMutation.isPending}
      onGenerate={handleGenerate}
      onSave={handleSave}
    />
  );
}
