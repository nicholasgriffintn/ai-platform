import { FormSelect } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectFlowNode } from "@ngriffin_uk/polychat-schemas";

export function FlowNextStep({
  label,
  nodes,
  value,
  onChange,
}: {
  label: string;
  nodes: ProjectFlowNode[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <FormSelect
      label={label}
      value={value}
      options={nodes.map((node) => ({ value: node.id, label: node.name }))}
      onValueChange={onChange}
    />
  );
}
