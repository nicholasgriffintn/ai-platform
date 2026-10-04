import { FormInput } from "@ngriffin_uk/polychat-component-ui";

import type { UserSettingsFormData } from "./user-settings";

const FIELDS = [
  {
    key: "dynamodb_vectors_table_name",
    label: "DynamoDB table name",
    placeholder: "polychat-vectors",
  },
  { key: "dynamodb_vectors_index_name", label: "Vector index name", placeholder: "embeddings" },
  { key: "dynamodb_vectors_region", label: "AWS region", placeholder: "us-east-1" },
] as const;

export function DynamoDbVectorSettings({
  settings,
  onChange,
}: {
  settings: UserSettingsFormData;
  onChange: (patch: Partial<UserSettingsFormData>) => void;
}) {
  return (
    <>
      {FIELDS.map(({ key, label, placeholder }) => (
        <FormInput
          key={key}
          id={key}
          name={key}
          label={label}
          placeholder={placeholder}
          value={settings[key] ?? ""}
          required
          onChange={(event) => onChange({ [key]: event.target.value })}
        />
      ))}
      <p className="text-sm text-muted-foreground">
        Configure DynamoDB Vectors credentials in Providers. Use an on-demand table with a
        1,024-dimensional cosine vector index.
      </p>
    </>
  );
}
