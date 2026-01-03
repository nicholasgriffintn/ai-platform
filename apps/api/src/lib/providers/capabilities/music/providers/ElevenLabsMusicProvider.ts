import { ReplicateMusicProvider } from "./ReplicateMusicProvider";

const DEFAULT_MODEL = "replicate-elevenlabs-music";

export class ElevenLabsMusicProvider extends ReplicateMusicProvider {
	name = "elevenlabs";
	models = [DEFAULT_MODEL];

	protected getDefaultModel(): string {
		return DEFAULT_MODEL;
	}
}
