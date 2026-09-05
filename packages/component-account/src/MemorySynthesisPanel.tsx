import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { formatDate } from "@ngriffin_uk/polychat-utility-core";
import { Brain } from "lucide-react";

export interface MemorySynthesisRecord {
  id: string;
  synthesis_text: string;
  synthesis_version?: number | null;
  memory_count?: number;
  created_at: string;
}

export interface MemorySynthesisPanelProps {
  synthesis?: MemorySynthesisRecord | null;
  previousSyntheses: MemorySynthesisRecord[];
  isLoadingSynthesis: boolean;
  isLoadingHistory: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function MemorySynthesisPanel({
  synthesis,
  previousSyntheses,
  isLoadingSynthesis,
  isLoadingHistory,
  isGenerating,
  onGenerate,
}: MemorySynthesisPanelProps) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b py-5">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Brain size={18} className="text-muted-foreground" />
            Memory synthesis
          </CardTitle>
          <CardDescription className="mt-1">
            A consolidated view of the personal memories Polychat uses in conversations.
          </CardDescription>
        </div>
        <CardAction>
          <Button variant="secondary" size="sm" isLoading={isGenerating} onClick={onGenerate}>
            Generate synthesis
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="py-5">
        {isLoadingSynthesis ? (
          <p className="text-sm text-muted-foreground">Loading memory synthesis…</p>
        ) : synthesis ? (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {synthesis.synthesis_text}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {synthesis.synthesis_version ? (
                <span>Version {synthesis.synthesis_version}</span>
              ) : null}
              {synthesis.memory_count !== undefined ? (
                <span>{synthesis.memory_count} memories</span>
              ) : null}
              <span>Generated {formatDate(synthesis.created_at)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No synthesis yet. Generate one after Polychat has saved some memories.
          </p>
        )}

        {!isLoadingHistory && previousSyntheses.length > 0 ? (
          <div className="mt-5 border-t border-border pt-5">
            <h3 className="text-muted-foreground text-sm font-medium mb-3">Previous syntheses</h3>
            <div className="space-y-3">
              {previousSyntheses.map((item) => (
                <div key={item.id} className="bg-surface-elevated rounded-lg p-3">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.synthesis_text}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.synthesis_version ? `Version ${item.synthesis_version} · ` : ""}
                    {formatDate(item.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
