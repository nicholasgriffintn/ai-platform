import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { TrainingModelDefinition } from "@ngriffin_uk/polychat-schemas";

interface ModelCatalogProps {
  models: TrainingModelDefinition[];
}

export function ModelCatalog({ models }: ModelCatalogProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {models.map((model) => (
        <Card key={model.id} className="shadow-none">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>{model.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{model.baseModel}</p>
              </div>
              <Badge variant="outline">{model.provider}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {model.description && <p className="text-sm text-foreground">{model.description}</p>}
            {model.defaultEntryPoint && (
              <div className="text-xs text-muted-foreground">
                Entry point:{" "}
                <span className="font-mono text-foreground">{model.defaultEntryPoint}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{model.family}</Badge>
              {model.supportedTasks?.map((task) => (
                <Badge key={task} variant="outline">
                  {task}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
