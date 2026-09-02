import "server-only";

import { ProxyAgent, type Dispatcher } from "undici";
import { normalizeOutboundProxyUrl } from "@/lib/outbound-proxy-config";

let cachedProxy: { url: string; dispatcher: Dispatcher } | undefined;

/**
 * Returns one shared dispatcher for all public-source metadata requests.
 * The URL is intentionally read only on the server and must never use a
 * NEXT_PUBLIC_ environment variable.
 */
export function getOutboundProxyDispatcher(): Dispatcher | undefined {
  const proxyUrl = normalizeOutboundProxyUrl(process.env.LIVE_EARTH_PROXY_URL);
  if (!proxyUrl) return undefined;

  if (cachedProxy?.url === proxyUrl) return cachedProxy.dispatcher;

  const dispatcher = new ProxyAgent(proxyUrl);
  cachedProxy = { url: proxyUrl, dispatcher };
  return dispatcher;
}
