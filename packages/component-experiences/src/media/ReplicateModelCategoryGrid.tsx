import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface ReplicateModelCategory<TModel> {
  category: string;
  models: TModel[];
}

export interface ReplicateModelCategoryGridProps<TModel extends { id: string }> {
  categories: ReplicateModelCategory<TModel>[];
  renderModel: (model: TModel) => ReactNode;
}

export function ReplicateModelCategoryGrid<TModel extends { id: string }>({
  categories,
  renderModel,
}: ReplicateModelCategoryGridProps<TModel>) {
  return (
    <>
      {categories.map(({ category, models }) => (
        <div key={category} className="space-y-6 mb-8">
          <h2
            data-category={category}
            className={cn("text-xl font-semibold text-foreground border-b border-border pb-2")}
          >
            {category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => (
              <div
                key={model.id}
                className="transform transition-transform hover:scale-[1.02] h-[200px]"
              >
                {renderModel(model)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
