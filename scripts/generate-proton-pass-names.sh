pass-cli item list --vault-name "API keys" --filter-state active --output json |
jq -r --rawfile env apps/api/.dev.vars.example '
  def norm: ascii_upcase | gsub("[^A-Z0-9]"; "");
  ($env | split("\n")
    | map(select(test("^[A-Z][A-Z0-9_]*=")))
    | map(split("=")[0])
    | map(select(test("(_API_KEY|_API_TOKEN)$") or test("^BEDROCK_AWS_(ACCESS|SECRET)_KEY$")))) as $keys
  | [.items[] | select(.item_type == "custom" and .state == "Active")] as $items
  | $keys[]
  | . as $key
  | (if ($key | startswith("BEDROCK_AWS_"))
     then "BEDROCK"
     else ($key | sub("_(API_KEY|API_TOKEN)$"; ""))
     end) as $wanted
  | ($items | map(select((.title | norm) == ($wanted | norm))) | .[0]) as $item
  | select($item != null)
  | (if $key == "BEDROCK_AWS_ACCESS_KEY" then "aws ACCESS KEY"
     elif $key == "BEDROCK_AWS_SECRET_KEY" then "aws SECRET KEY"
     else "API Key"
     end) as $field
  | "\($key)=\"pass://API keys/\($item.title)/\($field)\""
'
