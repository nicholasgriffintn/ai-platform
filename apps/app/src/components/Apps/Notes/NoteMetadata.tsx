import {
	Calendar,
	Clock,
	Edit3,
	FileText,
	Hash,
	Monitor,
	Tag,
	User,
} from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Textarea } from "~/components/ui/Textarea";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface NoteMetadataProps {
	metadata?: Record<string, any>;
	onMetadataUpdate?: (metadata: Record<string, any>) => void;
	isEditable?: boolean;
}

export function NoteMetadata({
	metadata,
	onMetadataUpdate,
	isEditable = false,
}: NoteMetadataProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editingMetadata, setEditingMetadata] = useState(metadata || {});

	if (!metadata && !isEditable) return null;

	const handleSave = () => {
		onMetadataUpdate?.(editingMetadata);
		setIsEditing(false);
	};

	const handleCancel = () => {
		setEditingMetadata(metadata || {});
		setIsEditing(false);
	};

	const handleTagsChange = (value: string) => {
		const tags = value
			.split(",")
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
		setEditingMetadata((prev) => ({ ...prev, tags }));
	};

	const handleKeyTopicsChange = (value: string) => {
		const keyTopics = value
			.split(",")
			.map((topic) => topic.trim())
			.filter((topic) => topic.length > 0);
		setEditingMetadata((prev) => ({ ...prev, keyTopics }));
	};

	const getSentimentColor = (sentiment?: string) => {
		switch (sentiment) {
			case "positive":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
			case "negative":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
		}
	};

	const getSourceTypeIcon = (sourceType?: string) => {
		switch (sourceType) {
			case "tab_recording":
				return (
					<Monitor size={14} className="text-gray-600 dark:text-gray-400" />
				);
			case "manual":
				return <User size={14} className="text-gray-600 dark:text-gray-400" />;
			default:
				return (
					<FileText size={14} className="text-gray-600 dark:text-gray-400" />
				);
		}
	};

	if (isEditing) {
		return (
			<div className="border rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
						<Hash size={16} className="text-gray-600 dark:text-gray-400" />
						Edit Metadata
					</h3>
					<div className="flex gap-2">
						<Button variant="secondary" size="sm" onClick={handleCancel}>
							Cancel
						</Button>
						<Button variant="default" size="sm" onClick={handleSave}>
							Save
						</Button>
					</div>
				</div>

				<div className="grid gap-4">
					<div>
						<label
							htmlFor="summary-input"
							className="text-xs font-medium text-gray-500 dark:text-gray-400"
						>
							Summary
						</label>
						<Textarea
							id="summary-input"
							value={editingMetadata.summary || ""}
							onChange={(e) =>
								setEditingMetadata((prev) => ({
									...prev,
									summary: e.target.value,
								}))
							}
							className="mt-1"
							rows={2}
						/>
					</div>

					<div>
						<label
							htmlFor="tags-input"
							className="text-xs font-medium text-gray-500 dark:text-gray-400"
						>
							Tags (comma separated)
						</label>
						<Input
							id="tags-input"
							value={editingMetadata.tags?.join(", ") || ""}
							onChange={(e) => handleTagsChange(e.target.value)}
							className="mt-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
							placeholder="tag1, tag2, tag3"
						/>
					</div>

					<div>
						<label
							htmlFor="topics-input"
							className="text-xs font-medium text-gray-500 dark:text-gray-400"
						>
							Key Topics (comma separated)
						</label>
						<Input
							id="topics-input"
							value={editingMetadata.keyTopics?.join(", ") || ""}
							onChange={(e) => handleKeyTopicsChange(e.target.value)}
							className="mt-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
							placeholder="topic1, topic2, topic3"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="content-type-select"
								className="text-xs font-medium text-gray-500 dark:text-gray-400"
							>
								Content Type
							</label>
							<select
								id="content-type-select"
								value={editingMetadata.contentType || "text"}
								onChange={(e) =>
									setEditingMetadata((prev) => ({
										...prev,
										contentType: e.target.value,
									}))
								}
								className="mt-1 w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
							>
								<option value="text">Text</option>
								<option value="list">List</option>
								<option value="outline">Outline</option>
								<option value="mixed">Mixed</option>
							</select>
						</div>

						<div>
							<label
								htmlFor="sentiment-select"
								className="text-xs font-medium text-gray-500 dark:text-gray-400"
							>
								Sentiment
							</label>
							<select
								id="sentiment-select"
								value={editingMetadata.sentiment || "neutral"}
								onChange={(e) =>
									setEditingMetadata((prev) => ({
										...prev,
										sentiment: e.target.value,
									}))
								}
								className="mt-1 w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
							>
								<option value="positive">Positive</option>
								<option value="neutral">Neutral</option>
								<option value="negative">Negative</option>
							</select>
						</div>
					</div>

					{editingMetadata.tabSource && (
						<div className="pt-4 border-t">
							<h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
								<Monitor
									size={14}
									className="text-gray-600 dark:text-gray-400"
								/>
								Capture Source
							</h4>
							<div className="grid gap-3">
								<div>
									<label
										htmlFor="tab-title-input"
										className="text-xs font-medium text-gray-500 dark:text-gray-400"
									>
										Title
									</label>
									<Input
										id="tab-title-input"
										value={editingMetadata.tabSource?.title || ""}
										onChange={(e) =>
											setEditingMetadata((prev) => ({
												...prev,
												tabSource: { ...prev.tabSource, title: e.target.value },
											}))
										}
										className="mt-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
										placeholder="Source title"
									/>
								</div>
								<div>
									<label
										htmlFor="tab-url-input"
										className="text-xs font-medium text-gray-500 dark:text-gray-400"
									>
										URL
									</label>
									<Input
										id="tab-url-input"
										value={editingMetadata.tabSource?.url || ""}
										onChange={(e) =>
											setEditingMetadata((prev) => ({
												...prev,
												tabSource: { ...prev.tabSource, url: e.target.value },
											}))
										}
										className="mt-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
										placeholder="https://example.com"
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
					<Hash size={16} className="text-gray-600 dark:text-gray-400" />
					Note Metadata
				</h3>
				{isEditable && (
					<Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
						<Edit3 size={14} />
					</Button>
				)}
			</div>

			<div className="space-y-3">
				{metadata?.summary && (
					<div>
						<div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
							Summary
						</div>
						<p className="text-sm text-gray-800 dark:text-gray-200">
							{metadata.summary}
						</p>
					</div>
				)}

				{metadata?.tags && metadata.tags.length > 0 && (
					<div>
						<div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
							<Tag size={12} className="text-gray-600 dark:text-gray-400" />
							Tags
						</div>
						<div className="flex flex-wrap gap-1">
							{metadata.tags.map((tag: string) => (
								<Badge key={tag} variant="secondary" className="text-xs">
									{tag}
								</Badge>
							))}
						</div>
					</div>
				)}

				{metadata?.keyTopics && metadata.keyTopics.length > 0 && (
					<div>
						<div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
							Key Topics
						</div>
						<div className="flex flex-wrap gap-1">
							{metadata.keyTopics.map((topic: string) => (
								<Badge key={topic} variant="outline" className="text-xs">
									{topic}
								</Badge>
							))}
						</div>
					</div>
				)}

				<div className="grid grid-cols-2 gap-4 text-xs">
					{metadata?.wordCount && (
						<div className="flex items-center gap-1">
							<FileText
								size={12}
								className="text-gray-600 dark:text-gray-400"
							/>
							<span className="text-gray-500 dark:text-gray-400">Words:</span>
							<span className="text-gray-800 dark:text-gray-200">
								{metadata.wordCount.toLocaleString()}
							</span>
						</div>
					)}

					{metadata?.readingTime && (
						<div className="flex items-center gap-1">
							<Clock size={12} className="text-gray-600 dark:text-gray-400" />
							<span className="text-gray-500 dark:text-gray-400">Read:</span>
							<span className="text-gray-800 dark:text-gray-200">
								{metadata.readingTime}min
							</span>
						</div>
					)}

					{metadata?.contentType && (
						<div className="flex items-center gap-1">
							<FileText
								size={12}
								className="text-gray-600 dark:text-gray-400"
							/>
							<span className="text-gray-500 dark:text-gray-400">Type:</span>
							<span className="capitalize text-gray-800 dark:text-gray-200">
								{metadata.contentType}
							</span>
						</div>
					)}

					{metadata?.sentiment && (
						<div className="flex items-center gap-1">
							<span
								className={cn(
									"px-2 py-1 rounded text-xs capitalize",
									getSentimentColor(metadata.sentiment),
								)}
							>
								{metadata.sentiment}
							</span>
						</div>
					)}

					{metadata?.sourceType && (
						<div className="flex items-center gap-1">
							{getSourceTypeIcon(metadata.sourceType)}
							<span className="text-gray-500 dark:text-gray-400">Source:</span>
							<span className="capitalize text-gray-800 dark:text-gray-200">
								{metadata.sourceType.replace("_", " ")}
							</span>
						</div>
					)}
				</div>

				{metadata?.tabSource && (
					<div className="pt-2 border-t">
						<div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
							<Monitor size={12} className="text-gray-600 dark:text-gray-400" />
							Capture Source
						</div>
						<div className="text-xs space-y-1">
							{metadata.tabSource.title && (
								<div>
									<span className="text-gray-500 dark:text-gray-400">
										Title:
									</span>{" "}
									<span className="text-gray-800 dark:text-gray-200">
										{metadata.tabSource.title}
									</span>
								</div>
							)}
							{metadata.tabSource.url && (
								<div>
									<span className="text-gray-500 dark:text-gray-400">URL:</span>
									<a
										href={metadata.tabSource.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 dark:text-blue-400 no-underline hover:underline ml-1"
									>
										{metadata.tabSource.url}
									</a>
								</div>
							)}
							{metadata.tabSource.timestamp && (
								<div className="flex items-center gap-1">
									<Calendar
										size={12}
										className="text-gray-600 dark:text-gray-400"
									/>
									<span className="text-gray-500 dark:text-gray-400">
										Captured:
									</span>
									<span className="text-gray-800 dark:text-gray-200">
										{new Date(metadata.tabSource.timestamp).toLocaleString()}
									</span>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
