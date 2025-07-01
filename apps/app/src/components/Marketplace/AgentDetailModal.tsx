import { Calendar, Download, Star, User, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Dialog } from "~/components/ui/Dialog";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { MarketplaceAgent } from "~/types";

interface AgentDetailModalProps {
  agent: MarketplaceAgent | null;
  isOpen: boolean;
  onClose: () => void;
  onInstall: (agentId: string) => Promise<void>;
  onRate?: (agentId: string, rating: number, review?: string) => Promise<void>;
  isInstalled?: boolean;
  isInstalling?: boolean;
}

export function AgentDetailModal({
  agent,
  isOpen,
  onClose,
  onInstall,
  onRate,
  isInstalled = false,
  isInstalling = false,
}: AgentDetailModalProps) {
  const [isRating, setIsRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [review, setReview] = useState("");

  if (!agent) {
    return null;
  }

  const rating = Number.parseFloat(agent.rating_average) || 0;
  const hasRating = agent.rating_count > 0;

  const handleInstall = async () => {
    if (!isInstalled && !isInstalling) {
      await onInstall(agent.id);
    }
  };

  const handleSubmitRating = async () => {
    if (!onRate || selectedRating === 0) return;

    try {
      setIsRating(true);
      await onRate(agent.id, selectedRating, review.trim() || undefined);
      setSelectedRating(0);
      setReview("");
    } finally {
      setIsRating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b px-6 py-4 flex items-start justify-between">
            <div className="flex items-center gap-4">
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="w-16 h-16 rounded-xl object-cover ring-2 ring-gray-200 dark:ring-gray-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">{agent.name}</h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>by {agent.author}</span>
                </div>
                {agent.is_featured && (
                  <Badge className="mt-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                    ⭐ Featured
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {agent.description || "No description available."}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-muted-foreground" />
                      <span>Installs</span>
                    </div>
                    <span className="font-semibold">
                      {agent.usage_count.toLocaleString()}
                    </span>
                  </div>
                  {hasRating && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>Rating</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {rating.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          ({agent.rating_count} reviews)
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Added</span>
                    </div>
                    <span className="text-muted-foreground text-sm">
                      {new Date(agent.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agent.category && (
                    <div className="flex items-center justify-between">
                      <span>Category</span>
                      <Badge variant="outline">{agent.category}</Badge>
                    </div>
                  )}
                  {agent.model && (
                    <div className="flex items-center justify-between">
                      <span>Model</span>
                      <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {agent.model}
                      </span>
                    </div>
                  )}
                  {agent.temperature !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Temperature</span>
                      <span className="text-sm font-mono">
                        {agent.temperature}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {agent.tags && agent.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {agent.system_prompt && (
              <Card>
                <CardHeader>
                  <CardTitle>System Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {agent.system_prompt}
                  </pre>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-4 pt-4 border-t">
              <Button
                size="lg"
                className={cn(
                  "flex-1 gap-2",
                  isInstalled &&
                    "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800",
                )}
                disabled={isInstalling}
                onClick={handleInstall}
              >
                {isInstalling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Installing...
                  </>
                ) : isInstalled ? (
                  <>
                    <Users className="w-4 h-4" />
                    Installed
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Install Agent
                  </>
                )}
              </Button>

              {onRate && !isInstalled && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsRating(!isRating)}
                  className="gap-2"
                >
                  <Star className="w-4 h-4" />
                  Rate
                </Button>
              )}
            </div>

            {isRating && onRate && (
              <Card>
                <CardHeader>
                  <CardTitle>Rate this Agent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setSelectedRating(star)}
                        className={cn(
                          "transition-colors",
                          star <= selectedRating
                            ? "text-yellow-400"
                            : "text-gray-300 hover:text-yellow-200",
                        )}
                      >
                        <Star
                          className={cn(
                            "w-6 h-6",
                            star <= selectedRating && "fill-current",
                          )}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {selectedRating > 0
                        ? `${selectedRating} star${selectedRating === 1 ? "" : "s"}`
                        : "Select rating"}
                    </span>
                  </div>
                  <textarea
                    placeholder="Optional review..."
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSubmitRating}
                      disabled={selectedRating === 0 || isRating}
                      className="gap-2"
                    >
                      {isRating && (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      Submit Rating
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsRating(false);
                        setSelectedRating(0);
                        setReview("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
