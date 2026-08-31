import { NextRequest, NextResponse } from "next/server";
import type { Channel } from "@liveearth/domain/types";
import { getGlobePoints } from "@/lib/data";

const CHANNELS = new Set<Channel>(["earth", "storm", "ocean", "night"]);

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("channel") ?? "earth";
  if (!CHANNELS.has(value as Channel)) {
    return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
  }
  return NextResponse.json(await getGlobePoints(value as Channel), {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" },
  });
}
