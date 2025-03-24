import { AwsClient } from "aws4fetch";

import type { StorageService } from "../storage";

interface PollyResponse {
  SynthesisTask: {
    TaskId: string;
    TaskStatus: string;
    TaskStatusReason?: string;
    OutputUri?: string;
  };
}

export class PollyService {
  private client: AwsClient;
  private pollyEndpoint: string;
  private s3Bucket: string;

  constructor(config: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    });
    this.pollyEndpoint = `https://polly.${config.region}.amazonaws.com/v1/synthesisTasks`;
    this.s3Bucket = "polly-text-to-speech-input";
  }

  async synthesizeSpeech(
    content: string,
    storageService: StorageService,
    slug: string,
  ): Promise<string> {
    try {
      const response = await this.client.fetch(this.pollyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Text: content,
          OutputFormat: "mp3",
          VoiceId: "Ruth",
          Engine: "long-form",
          TextType: "ssml",
          OutputS3BucketName: this.s3Bucket,
          OutputS3KeyPrefix: `polly/${slug}`,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Polly API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as PollyResponse;
      const taskId = data.SynthesisTask.TaskId;

      while (true) {
        const taskResponse = await this.client.fetch(
          `${this.pollyEndpoint}/${taskId}`,
          { method: "GET" },
        );

        if (!taskResponse.ok) {
          throw new Error(
            `Failed to check task status: ${taskResponse.status}`,
          );
        }

        const taskData = (await taskResponse.json()) as PollyResponse;
        const status = taskData.SynthesisTask.TaskStatus;

        if (status === "completed") {
          if (!taskData.SynthesisTask.OutputUri) {
            throw new Error("Output URI is missing");
          }

          const s3Response = await this.client.fetch(
            taskData.SynthesisTask.OutputUri,
            { method: "GET" },
          );

          if (!s3Response.ok) {
            throw new Error(
              `Failed to fetch audio from S3: ${s3Response.status}`,
            );
          }

          const audioBuffer = await s3Response.arrayBuffer();
          const audioKey = `audio/${slug}.mp3`;

          await storageService.uploadObject(
            audioKey,
            new Uint8Array(audioBuffer),
          );

          return audioKey;
        }

        if (status === "failed") {
          throw new Error(
            `Task failed: ${taskData.SynthesisTask.TaskStatusReason}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error("Error generating audio with Polly:", error);
      throw error;
    }
  }
}
