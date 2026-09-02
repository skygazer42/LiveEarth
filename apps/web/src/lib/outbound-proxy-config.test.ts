import { describe, expect, it } from "vitest";
import {
  getOutboundProxyMode,
  normalizeOutboundProxyUrl,
} from "@/lib/outbound-proxy-config";

describe("outbound proxy configuration", () => {
  it("keeps public-source requests direct when no proxy is configured", () => {
    expect(normalizeOutboundProxyUrl(undefined)).toBeUndefined();
    expect(normalizeOutboundProxyUrl("   ")).toBeUndefined();
    expect(getOutboundProxyMode(undefined)).toBe("direct");
  });

  it("accepts a local host and port as an HTTP proxy", () => {
    expect(normalizeOutboundProxyUrl("127.0.0.1:7890")).toBe(
      "http://127.0.0.1:7890/",
    );
    expect(getOutboundProxyMode("127.0.0.1:7890")).toBe("proxy");
  });

  it("accepts authenticated HTTPS and SOCKS5 proxy URLs", () => {
    expect(normalizeOutboundProxyUrl("https://user:pass@proxy.example:8443")).toBe(
      "https://user:pass@proxy.example:8443/",
    );
    expect(normalizeOutboundProxyUrl("socks5://127.0.0.1:1080")).toBe(
      "socks5://127.0.0.1:1080",
    );
  });

  it("rejects unsupported protocols without returning the configured value", () => {
    expect(() => normalizeOutboundProxyUrl("file:///tmp/proxy.sock")).toThrow(
      /must use http, https, socks, or socks5/,
    );
    expect(getOutboundProxyMode("file:///tmp/proxy.sock")).toBe("invalid");
  });
});
