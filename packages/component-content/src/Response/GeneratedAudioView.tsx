import type { GeneratedAudioResponseData } from "./response-data";

interface GeneratedAudioViewProps {
	data: GeneratedAudioResponseData;
}

export function GeneratedAudioView({ data }: GeneratedAudioViewProps) {
	return (
		<div data-responsetype="generated-audio" className="space-y-3">
			<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{data.title}</h2>
			{data.content && <p className="text-sm text-zinc-700 dark:text-zinc-300">{data.content}</p>}
			<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
				<audio controls crossOrigin="use-credentials" className="w-full rounded-lg">
					<source src={data.audioUrl} type="audio/mpeg" />
					<track kind="captions" />
					Your browser does not support the audio element.
				</audio>
			</div>
		</div>
	);
}
