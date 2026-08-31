import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "liveearth-web",
    time: new Date().toISOString(),
    demo: process.env.NODE_ENV !== "production" && process.env.LIVE_EARTH_DEMO_MODE !== "false",
  });
}
