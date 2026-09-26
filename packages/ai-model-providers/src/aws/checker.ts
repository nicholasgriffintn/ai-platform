import type { ConnectionCheck } from "@ngriffin_uk/polychat-schemas";

import { AwsRequester, readAwsSettings } from "../auth/aws.js";
import { modelProviderErrorFromStatus } from "../errors.js";
import { readUpstreamError } from "../http.js";
import type { ConnectionChecker, ProviderAdapterContext } from "../types.js";

export class AwsConnectionChecker implements ConnectionChecker {
  constructor(private readonly context: ProviderAdapterContext) {}

  async check(): Promise<ConnectionCheck> {
    const aws = new AwsRequester(readAwsSettings(this.context.credentials), this.context.fetcher);
    const response = await aws.signed("sts", `https://sts.${aws.settings.region}.amazonaws.com/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "Action=GetCallerIdentity&Version=2011-06-15",
    });

    if (!response.ok) {
      throw modelProviderErrorFromStatus(
        response.status,
        "Checking the AWS credentials",
        await readUpstreamError(response),
      );
    }

    const xml = await response.text();
    const account = /<Account>(\d+)<\/Account>/.exec(xml)?.[1] ?? "unknown";
    const bucketReady = aws.settings.bucket ? await aws.headS3Bucket(aws.settings.bucket) : false;
    const ready = bucketReady && Boolean(aws.settings.roleArn);

    return {
      account,
      capabilities: { read: bucketReady, store: bucketReady, train: ready, host: ready },
      namespaces: [],
      message: ready
        ? null
        : bucketReady
          ? "Add an execution role to train and host"
          : `The credentials cannot reach bucket ${aws.settings.bucket ?? "(none set)"}`,
    };
  }
}
