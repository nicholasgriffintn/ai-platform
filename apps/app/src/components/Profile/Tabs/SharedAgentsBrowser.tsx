import { Filter, Loader2, Search, Star } from "lucide-react";

import { EmptyState } from "~/components/Core/EmptyState";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/Card";
import { FormSelect } from "~/components/ui/Form/Select";
import { Input } from "~/components/ui/input";
import { useAgentFilters } from "~/hooks/useAgentFilters";
import { useSharedAgents } from "~/hooks/useSharedAgents";
import { SharedAgentCard } from "./cards/SharedAgentCard";

interface SharedAgentsBrowserProps {
	onInstall: (agentId: string) => Promise<any>;
	isInstalling: boolean;
}

export function SharedAgentsBrowser({
	onInstall,
	isInstalling,
}: SharedAgentsBrowserProps) {
	const {
		searchTerm,
		setSearchTerm,
		debouncedSearchTerm,
		selectedCategory,
		setSelectedCategory,
		selectedTag,
		setSelectedTag,
	} = useAgentFilters();

	const {
		sharedAgents,
		isLoadingSharedAgents,
		featuredAgents,
		isLoadingFeaturedAgents,
		categories,
		tags,
	} = useSharedAgents({
		category: selectedCategory,
		tags: selectedTag ? [selectedTag] : [],
		search: debouncedSearchTerm,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Search className="h-5 w-5" />
					Browse Agents
				</CardTitle>
				<CardDescription>
					Search and filter community-shared agents
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Featured Agents Section */}
				{isLoadingFeaturedAgents ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						<span className="ml-2 text-muted-foreground">
							Loading featured agents...
						</span>
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
								{featuredAgents.map((agent: any) => (
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
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10"
						/>
					</div>
					<div className="flex gap-2">
						<FormSelect
							value={selectedCategory}
							onChange={(e) => setSelectedCategory(e.target.value)}
							options={[
								{ value: "", label: "All categories" },
								...categories.map((c) => ({ value: c, label: c })),
							]}
							className="min-w-40"
						/>
						<FormSelect
							value={selectedTag}
							onChange={(e) => setSelectedTag(e.target.value)}
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
						<span className="ml-2 text-muted-foreground">
							Searching agents...
						</span>
					</div>
				) : sharedAgents.length === 0 ? (
					<EmptyState
						title="No Agents Found"
						message="Try adjusting your search terms or filters to find more agents"
						icon={<Filter className="h-5 w-5" />}
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{sharedAgents.map((agent: any) => (
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
