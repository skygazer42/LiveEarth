const SUPPORTED_PROXY_PROTOCOLS = new Set(["http:", "https:", "socks:", "socks5:"]);

export type OutboundProxyMode = "direct" | "proxy" | "invalid";

/**
 * Normalizes the operator-controlled proxy value without ever exposing it to
 * the browser. A host:port value is treated as a conventional HTTP proxy.
 */
export function normalizeOutboundProxyUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let proxyUrl: URL;
  try {
    proxyUrl = new URL(candidate);
  } catch {
    throw new Error(
      "LIVE_EARTH_PROXY_URL must be a proxy URL such as http://127.0.0.1:7890",
    );
  }

  if (!SUPPORTED_PROXY_PROTOCOLS.has(proxyUrl.protocol)) {
    throw new Error(
      "LIVE_EARTH_PROXY_URL must use http, https, socks, or socks5",
    );
  }
  if (!proxyUrl.hostname) {
    throw new Error("LIVE_EARTH_PROXY_URL must include a hostname");
  }

  return proxyUrl.href;
}

export function getOutboundProxyMode(value: string | undefined): OutboundProxyMode {
  if (!value?.trim()) return "direct";
  try {
    normalizeOutboundProxyUrl(value);
    return "proxy";
  } catch {
    return "invalid";
  }
}
