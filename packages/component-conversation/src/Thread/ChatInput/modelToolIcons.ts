import type { ModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  Code,
  Database,
  Image,
  Link,
  ListFilter,
  Search,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export const MODEL_TOOL_ICONS: Record<ModelToolId, LucideIcon> = {
  code_execution: Code,
  file_search: Database,
  hosted_shell: Terminal,
  image_generation: Image,
  mcp: ListFilter,
  search_grounding: Search,
  tool_search: ListFilter,
  web_fetch: Link,
};
