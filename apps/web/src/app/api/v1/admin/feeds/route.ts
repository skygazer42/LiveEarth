import { NextRequest, NextResponse } from "next/server";
import { feedRegistrationSchema } from "@liveearth/domain/schemas";
import type { Scene } from "@liveearth/domain/types";
import { getAdminContext } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";

export async function POST(request: NextRequest) {
  const parsed = feedRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feed contract", issues: parsed.error.issues }, { status: 400 });
  }
  if (new Date(parsed.data.rightsExpiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Rights window must end in the future" }, { status: 400 });
  }

  if (isDemoMode()) {
    return NextResponse.json({ id: `validated-${crypto.randomUUID()}`, persisted: false }, { status: 202 });
  }

  const { supabase, user, isAdmin } = await getAdminContext();
  if (!supabase || !user || !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feed = parsed.data;
  const sceneId = crypto.randomUUID();
  const registeredAt = new Date().toISOString();
  const neverObserved = new Date(0).toISOString();
  const { data, error } = await supabase
    .from("feeds")
    .insert({
      name: feed.name,
      slug: feed.slug,
      city: feed.city,
      region: feed.region,
      country: feed.country,
      country_code: feed.countryCode,
      title: feed.title,
      source_url: feed.sourceUrl,
      source_protocol: feed.sourceProtocol,
      playback_url: feed.playbackUrl,
      poster_url: feed.posterUrl,
      latitude: feed.latitude,
      longitude: feed.longitude,
      timezone: feed.timezone,
      primary_channel: feed.primaryChannel,
      channels: feed.channels,
      attribution: feed.attribution,
      rights_expires_at: feed.rightsExpiresAt,
      allow_audio: feed.allowAudio,
      allow_transcoding: feed.allowTranscoding,
      allow_frame_analysis: feed.allowFrameAnalysis,
      allow_derived_metadata: feed.allowDerivedMetadata,
      max_retention_hours: feed.maxRetentionHours,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "A feed already uses that slug" : "Could not register feed" },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  const initialScene: Scene = {
    id: sceneId,
    slug: feed.slug,
    city: feed.city,
    region: feed.region,
    country: feed.country,
    countryCode: feed.countryCode,
    latitude: feed.latitude,
    longitude: feed.longitude,
    timezone: feed.timezone,
    title: feed.title,
    primaryChannel: feed.primaryChannel,
    channels: feed.channels,
    media: {
      kind: "hls",
      posterUrl: feed.posterUrl,
      playbackUrl: feed.playbackUrl,
      audio: feed.allowAudio,
      demoOnly: false,
      attribution: feed.attribution,
    },
    health: {
      state: "offline",
      checkedAt: registeredAt,
      lastFrameAt: neverObserved,
      latencyMs: 0,
      bitrateKbps: 0,
      consecutiveFailures: 0,
      flags: [],
    },
    analysis: {
      observedAt: neverObserved,
      expiresAt: neverObserved,
      channelScore: 0,
      editorialScore: 0,
      breakdown: {
        visualImpact: 0,
        eventIntensity: 0,
        motion: 0,
        visibility: 0,
        technicalQuality: 0,
        rarity: 0,
      },
      labels: [],
      reason: {
        en: "Awaiting the first verified live analysis.",
        zh: "正在等待首次实时画面验证。",
      },
      confidence: 0,
      evidence: [],
      weather: {
        observedAt: neverObserved,
        weatherCode: 0,
        temperatureC: 0,
        windKph: 0,
        precipitationMm: 0,
        cloudCoverPercent: 0,
        source: "none",
      },
    },
    scoreHistory: [],
  };

  const { error: sceneError } = await supabase.from("published_scenes").insert({
    id: sceneId,
    feed_id: data.id,
    slug: feed.slug,
    channel: feed.primaryChannel,
    payload: initialScene,
    analysis_observed_at: neverObserved,
    last_frame_at: neverObserved,
    is_publishable: false,
  });
  if (sceneError) {
    await supabase.from("feeds").delete().eq("id", data.id);
    return NextResponse.json({ error: "Could not initialise scene" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, sceneId, persisted: true }, { status: 201 });
}
