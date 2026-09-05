import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  FormSelect,
  Input,
  Label,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import type { StrudelComplexity, StrudelStyle } from "@ngriffin_uk/polychat-schemas";
import { Save, Sparkles } from "lucide-react";

import type { PatternExample } from "./examples";
import { StrudelPlayer } from "./StrudelPlayer";

const STYLE_OPTIONS: { label: string; value: "" | StrudelStyle }[] = [
  { label: "Auto", value: "" },
  { label: "Techno", value: "techno" },
  { label: "Ambient", value: "ambient" },
  { label: "House", value: "house" },
  { label: "Jazz", value: "jazz" },
  { label: "Drums", value: "drums" },
  { label: "Experimental", value: "experimental" },
];

const COMPLEXITY_OPTIONS: { label: string; value: StrudelComplexity }[] = [
  { label: "Simple", value: "simple" },
  { label: "Medium", value: "medium" },
  { label: "Complex", value: "complex" },
];

export interface StrudelStudioProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  style: "" | StrudelStyle;
  onStyleChange: (value: "" | StrudelStyle) => void;
  complexity: StrudelComplexity;
  onComplexityChange: (value: StrudelComplexity) => void;
  tempo: string;
  onTempoChange: (value: string) => void;
  selectedModel: string;
  onSelectedModelChange: (value: string) => void;
  textModels: Array<{ value: string; label: string }>;
  code: string;
  onCodeChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  tagsInput: string;
  onTagsInputChange: (value: string) => void;
  parsedTags: string[];
  examples: PatternExample[];
  selectedExampleId: string | null;
  onSelectExample: (example: PatternExample) => void;
  isGenerating: boolean;
  isSaving: boolean;
  onGenerate: () => void;
  onSave: () => void;
}

export function StrudelStudio({
  prompt,
  onPromptChange,
  style,
  onStyleChange,
  complexity,
  onComplexityChange,
  tempo,
  onTempoChange,
  selectedModel,
  onSelectedModelChange,
  textModels,
  code,
  onCodeChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  tagsInput,
  onTagsInputChange,
  parsedTags,
  examples,
  selectedExampleId,
  onSelectExample,
  isGenerating,
  isSaving,
  onGenerate,
  onSave,
}: StrudelStudioProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-active-work/10 p-2 text-active-work">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>AI generation</CardTitle>
                <CardDescription>
                  Describe the groove you want and we will craft a Strudel seed.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="strudel-prompt">Describe your music</Label>
              <Textarea
                id="strudel-prompt"
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                rows={4}
                placeholder="e.g. hypnotic techno groove with syncopated hats and a rolling bassline"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormSelect
                label="Model"
                value={selectedModel}
                onChange={(event) => onSelectedModelChange(event.target.value)}
                options={[
                  { value: "", label: "Auto (Default)" },
                  ...textModels.map((m) => ({
                    value: m.value,
                    label: m.label,
                  })),
                ]}
              />
              <FormSelect
                label="Style"
                value={style}
                onChange={(event) => onStyleChange(event.target.value as StrudelStyle | "")}
                options={STYLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              <FormSelect
                label="Complexity"
                value={complexity}
                onChange={(event) => onComplexityChange(event.target.value as StrudelComplexity)}
                options={COMPLEXITY_OPTIONS}
              />
              <div className="space-y-2">
                <Label htmlFor="tempo">Tempo (BPM)</Label>
                <Input
                  id="tempo"
                  type="number"
                  inputMode="numeric"
                  min={60}
                  max={200}
                  value={tempo}
                  onChange={(event) => onTempoChange(event.target.value)}
                  placeholder="120"
                />
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              icon={<Sparkles className="h-4 w-4" />}
              onClick={onGenerate}
              isLoading={isGenerating}
            >
              Generate pattern
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle>Pattern preview</CardTitle>
            <CardDescription>
              Listen to the current pattern and review the generated code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StrudelPlayer code={code} onChange={onCodeChange} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pattern details</CardTitle>
            <CardDescription>Metadata used for sorting and sharing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-name">Name</Label>
              <Input
                id="pattern-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Afterhours groove"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pattern-description">Description</Label>
              <Textarea
                id="pattern-description"
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                rows={3}
                placeholder="Optional notes about instrumentation, energy or structure."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pattern-tags">
                Tags <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="pattern-tags"
                value={tagsInput}
                onChange={(event) => onTagsInputChange(event.target.value)}
                placeholder="drums, ambient, halftime"
              />
              <p className="text-xs text-muted-foreground">
                Use commas to separate tags for filtering.
              </p>
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {parsedTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="primary"
              fullWidth
              icon={<Save className="h-4 w-4" />}
              onClick={onSave}
              isLoading={isSaving}
            >
              Save Pattern
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Example patterns</CardTitle>
            <CardDescription>
              Start from a tried-and-tested groove. These load instantly—no AI request needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[340px] overflow-y-auto px-4">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => onSelectExample(example)}
                className={cn(
                  "w-full rounded-lg border border-dashed border-border px-4 py-3 text-left transition hover:border-active-work/60 cursor-pointer",
                  selectedExampleId === example.id && "border-active-work/80 bg-active-work/5",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{example.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {example.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {example.category}
                  </Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
