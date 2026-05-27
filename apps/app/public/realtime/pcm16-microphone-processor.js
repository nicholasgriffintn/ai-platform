const DEFAULT_BUFFER_SIZE = 4096;

function getBufferSize(options) {
	const configuredSize = options?.processorOptions?.bufferSize;
	return Number.isInteger(configuredSize) && configuredSize > 0
		? configuredSize
		: DEFAULT_BUFFER_SIZE;
}

class Pcm16MicrophoneProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super();
		this.bufferSize = getBufferSize(options);
		this.buffer = new Float32Array(this.bufferSize);
		this.offset = 0;
		this.isStopped = false;

		this.port.onmessage = (event) => {
			if (event.data?.type === "stop") {
				this.isStopped = true;
			}
		};
	}

	process(inputs, outputs) {
		const output = outputs[0];
		if (output) {
			for (const channel of output) {
				channel.fill(0);
			}
		}

		if (this.isStopped) {
			return false;
		}

		const input = inputs[0]?.[0];
		if (!input) {
			return true;
		}

		let readOffset = 0;
		while (readOffset < input.length) {
			const writableLength = Math.min(this.bufferSize - this.offset, input.length - readOffset);
			this.buffer.set(input.subarray(readOffset, readOffset + writableLength), this.offset);
			this.offset += writableLength;
			readOffset += writableLength;

			if (this.offset === this.bufferSize) {
				this.port.postMessage({ input: this.buffer.slice() });
				this.offset = 0;
			}
		}

		return true;
	}
}

registerProcessor("pcm16-microphone-processor", Pcm16MicrophoneProcessor);
