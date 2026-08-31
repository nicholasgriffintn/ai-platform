import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormSelect,
  Input,
} from "@ngriffin_uk/polychat-component-ui";
import type { SharedAgentSummary } from "@ngriffin_uk/polychat-schemas";
import { Filter, Loader2, Search, Star } from "lucide-react";

import { SharedAgentCard } from "./SharedAgentCard";

export interface SharedAgentsBrowserProps {
  searchTerm: string;
  onSearchTermChange: (searchTerm: string) => void;
  selectedCategory: string;
  onSelectedCategoryChange: (category: string) => void;
  selectedTag: string;
  onSelectedTagChange: (tag: string) => void;
  categories: string[];
  tags: string[];
  sharedAgents: SharedAgentSummary[];
  featuredAgents: SharedAgentSummary[];
  isLoadingSharedAgents: boolean;
  isLoadingFeaturedAgents: boolean;
  onInstall: (agentId: string) => Promise<unknown>;
  isInstalling: boolean;
}

export function SharedAgentsBrowser({
  searchTerm,
  onSearchTermChange,
  selectedCategory,
  onSelectedCategoryChange,
  selectedTag,
  onSelectedTagChange,
  categories,
  tags,
  sharedAgents,
  featuredAgents,
  isLoadingSharedAgents,
  isLoadingFeaturedAgents,
  onInstall,
  isInstalling,
}: SharedAgentsBrowserProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Browse Agents
        </CardTitle>
        <CardDescription>Search and filter community-shared agents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Featured Agents Section */}
        {isLoadingFeaturedAgents ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading featured agents...</span>
          </div>
        ) : featuredAgents.length === 0 ? (
          <EmptyState
            title="No Featured Agents"
            message="Check back later for featured agents from the community"
            icon={<Star className="h-5 w-5 text-yellow-500" />}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Featured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredAgents.map((agent) => (
                  <SharedAgentCard
                    key={agent.id}
                    agent={agent}
                    onInstall={onInstall}
                    isInstalling={isInstalling}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <FormSelect
              value={selectedCategory}
              onChange={(e) => onSelectedCategoryChange(e.target.value)}
              options={[
                { value: "", label: "All categories" },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
              className="min-w-40"
            />
            <FormSelect
              value={selectedTag}
              onChange={(e) => onSelectedTagChange(e.target.value)}
              options={[
                { value: "", label: "All tags" },
                ...tags.map((t) => ({ value: t, label: t })),
              ]}
              className="min-w-32"
            />
          </div>
        </div>

        {/* Search Results */}
        {isLoadingSharedAgents ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Searching agents...</span>
          </div>
        ) : sharedAgents.length === 0 ? (
          <EmptyState
            title="No Agents Found"
            message="Try adjusting your search terms or filters to find more agents"
            icon={<Filter className="h-5 w-5" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedAgents.map((agent) => (
              <SharedAgentCard
                key={agent.id}
                agent={agent}
                onInstall={onInstall}
                isInstalling={isInstalling}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
