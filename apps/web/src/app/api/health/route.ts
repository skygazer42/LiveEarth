import { NextResponse } from "next/server";
import { getDataMode } from "@/lib/demo-mode";
import { getOutboundProxyMode } from "@/lib/outbound-proxy-config";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "liveearth-web",
    time: new Date().toISOString(),
    dataMode: getDataMode(),
    outboundProxy: getOutboundProxyMode(process.env.LIVE_EARTH_PROXY_URL),
  });
}
