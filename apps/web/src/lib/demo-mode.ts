export function isDemoMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.LIVE_EARTH_DEMO_MODE !== "false";
}

export function publicDemoMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_LIVE_EARTH_DEMO_MODE !== "false";
}
