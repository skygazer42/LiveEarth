import "server-only";

export type LiveEarthDataMode = "public" | "supabase" | "demo";

export function getDataMode(): LiveEarthDataMode {
  const requested = process.env.LIVE_EARTH_DATA_MODE;
  if (requested === "public" || requested === "supabase") return requested;
  if (requested === "demo" && process.env.NODE_ENV !== "production") return "demo";
  if (process.env.NODE_ENV !== "production" && process.env.LIVE_EARTH_DEMO_MODE === "true") {
    return "demo";
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "supabase";
  }
  return "public";
}

export function isDemoMode(): boolean {
  return getDataMode() === "demo";
}
