import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Channel } from "@liveearth/domain/types";
import { getRankingSnapshot } from "@/lib/data";

const CHANNELS = new Set<Channel>(["earth", "storm", "ocean", "night"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channel: string }> },
) {
  const { channel: value } = await params;
  if (!CHANNELS.has(value as Channel)) {
    return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  }
  const channel = value as Channel;
  const snapshot = await getRankingSnapshot(channel);
  const etagValue = createHash("sha1")
    .update(
      JSON.stringify({
        version: snapshot.rankingVersion,
        scenes: snapshot.entries.map((entry) => [
          entry.scene.id,
          entry.scene.health.checkedAt,
          entry.scene.health.state,
        ]),
      }),
    )
    .digest("base64url");
  const etag = `"liveearth-${etagValue}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }
  return NextResponse.json(snapshot, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
    },
  });
}
