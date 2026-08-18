import type { ReactNode } from "react";

export interface CapabilityGroupSectionProps {
  id: string;
  label: string;
  count: number;
  children: ReactNode;
}

export function CapabilityGroupSection({
  id,
  label,
  count,
  children,
}: CapabilityGroupSectionProps) {
  return (
    <section aria-labelledby={`capability-kind-${id}`}>
      <div className="mb-4 flex items-center gap-2">
        <h2
          id={`capability-kind-${id}`}
          className="text-lg font-semibold text-zinc-950 dark:text-zinc-100"
        >
          {label}
        </h2>
        <span className="text-xs text-zinc-500">{count}</span>
      </div>
      <div className="space-y-7">{children}</div>
    </section>
  );
}

export interface CapabilityCategoryGroupProps {
  category: string;
  children: ReactNode;
}

export function CapabilityCategoryGroup({ category, children }: CapabilityCategoryGroupProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">{category}</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}
