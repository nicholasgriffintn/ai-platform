import type { AgentData } from "~/hooks/useAgents";

export interface MarketplaceAgent extends AgentData {
  id: string;
  user_id: number;
  agent_id: string;
  author: string;
  author_avatar?: string;
  category?: string;
  tags?: string[];
  is_featured: boolean;
  is_public: boolean;
  usage_count: number;
  rating_count: number;
  rating_average: string;
  created_at: string;
  updated_at: string;
}

export interface AgentInstall {
  id: string;
  user_id: number;
  shared_agent_id: string;
  agent_id: string;
  installed_at: string;
}

export interface AgentRating {
  id: string;
  user_id: number;
  shared_agent_id: string;
  rating: number;
  review?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceFilters {
  search?: string;
  category?: string;
  tags?: string[];
  sort?: "popular" | "recent" | "rating" | "name";
  featured?: boolean;
}

export interface MarketplaceStats {
  total_agents: number;
  total_installs: number;
  categories: Array<{
    category: string;
    count: number;
  }>;
  popular_tags: Array<{
    tag: string;
    count: number;
  }>;
}
