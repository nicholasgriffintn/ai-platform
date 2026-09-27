import type { ReplicateModel } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import {
  buildInitialFormData,
  isReplicateRequiredValueMissing,
  normaliseReplicateFormData,
} from "../utils/replicate-form";

export function useReplicateForm(model: ReplicateModel) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    buildInitialFormData(model),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prevModel, setPrevModel] = useState(model);

  if (model !== prevModel) {
    setPrevModel(model);
    setFormData(buildInitialFormData(model));
    setErrors({});
  }

  const handleChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setErrors((prev) => {
      const next = { ...prev };

      delete next[fieldName];

      return next;
    });
  };

  const validate = () => {
    const data = normaliseReplicateFormData(formData);
    const nextErrors: Record<string, string> = {};

    for (const field of model.inputSchema.fields) {
      if (field.required && isReplicateRequiredValueMissing(data[field.name])) {
        nextErrors[field.name] = `${field.name} is required`;
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0 ? data : null;
  };

  return { formData, errors, handleChange, validate };
}
