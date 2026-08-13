import "../styles.css";

export type MediaPreviewModel =
	| { type: "image"; url: string; alt: string }
	| { type: "video"; url: string; title: string }
	| { type: "audio"; url: string; title: string };

export function MediaPreview({
	preview,
	renderImage,
}: {
	preview: MediaPreviewModel;
	renderImage?: (preview: Extract<MediaPreviewModel, { type: "image" }>) => React.ReactNode;
}) {
	if (preview.type === "image")
		return (
			<div className="polychat-experience-media-preview">
				{renderImage ? (
					renderImage(preview)
				) : (
					<img src={preview.url} alt={preview.alt} loading="lazy" decoding="async" />
				)}
			</div>
		);
	if (preview.type === "video")
		return (
			<div className="polychat-experience-media-preview">
				<video controls aria-label={preview.title}>
					<source src={preview.url} type="video/mp4" />
				</video>
			</div>
		);
	return (
		<div className="polychat-experience-media-preview">
			<audio controls aria-label={preview.title}>
				<source src={preview.url} />
			</audio>
		</div>
	);
}
