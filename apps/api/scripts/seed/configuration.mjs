export function preferenceConfiguration({
  public_key,
  private_key,
  id,
  user_id,
  created_at,
  updated_at,
  ...payload
}) {
  return {
    kind: "preferences",
    id,
    user_id,
    payload,
    public_key: public_key ?? null,
    encrypted_value: private_key ?? null,
    created_at,
    updated_at,
  };
}
