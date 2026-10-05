import { Button, FormInput, FormSelect } from "@ngriffin_uk/polychat-component-ui";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { Plus, Trash2 } from "lucide-react";

import type { IdentityGroupDraft } from "./useIdentityConnectionForm.js";

export function IdentityGroupFields({
  mappings,
  disabled,
  onChange,
}: {
  mappings: IdentityGroupDraft[];
  disabled: boolean;
  onChange: (mappings: IdentityGroupDraft[]) => void;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Group access</legend>
      <p className="text-xs text-muted-foreground">
        Only these groups receive access. Admin takes precedence when a person belongs to both
        groups.
      </p>
      {mappings.map((mapping, index) => (
        <div key={mapping.id} className="flex items-end gap-3">
          <FormInput
            label={`Group ${index + 1}`}
            value={mapping.group}
            required
            maxLength={200}
            onChange={(event) =>
              onChange(
                mappings.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, group: event.target.value } : item,
                ),
              )
            }
          />
          <FormSelect<"admin" | "member">
            label="Role"
            value={mapping.role}
            disabled={disabled}
            options={[
              { value: "member", label: "Member" },
              { value: "admin", label: "Admin" },
            ]}
            onValueChange={(role) =>
              onChange(
                mappings.map((item, itemIndex) => (itemIndex === index ? { ...item, role } : item)),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || mappings.length === 1}
            aria-label={`Remove group ${index + 1}`}
            icon={<Trash2 size={16} />}
            onClick={() => onChange(mappings.filter((_, itemIndex) => itemIndex !== index))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || mappings.length >= 50}
        icon={<Plus size={14} />}
        onClick={() => onChange([...mappings, { id: generateId(), group: "", role: "member" }])}
      >
        Add group
      </Button>
    </fieldset>
  );
}
