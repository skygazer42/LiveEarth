interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
  errors: Array<{ message: string }>;
}

export interface CloudflareLiveInput {
  uid: string;
  rtmps: { url: string; streamKey: string };
  srt: { url: string; streamId: string; passphrase: string };
}

export async function createCloudflareLiveInput(input: {
  accountId: string;
  token: string;
  feedId: string;
  feedName: string;
}): Promise<CloudflareLiveInput> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(input.accountId)}/stream/live_inputs`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        meta: { feedId: input.feedId, name: input.feedName },
        recording: { mode: "automatic" },
        deleteRecordingAfterDays: 1,
        preferLowLatency: true,
      }),
    },
  );
  const body = (await response.json()) as CloudflareEnvelope<CloudflareLiveInput>;
  if (!response.ok || !body.success) {
    throw new Error(body.errors[0]?.message ?? `Cloudflare Stream returned ${response.status}`);
  }
  return body.result;
}
