"use client";

import { useState, type FormEvent } from "react";
import type { Locale, SceneChannel } from "@liveearth/domain/types";

export function FeedRegistrationForm({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [channels, setChannels] = useState<SceneChannel[]>(["ocean"]);
  const [primaryChannel, setPrimaryChannel] = useState<SceneChannel>("ocean");

  function toggleChannel(channel: SceneChannel) {
    setChannels((current) => {
      const next = current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel];
      if (!next.includes(primaryChannel) && next[0]) setPrimaryChannel(next[0]);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rightsDate = new Date(String(form.get("rightsExpiresAt")));
    if (Number.isNaN(rightsDate.getTime())) {
      setStatus("error");
      return;
    }
    const body = {
      name: form.get("name"),
      slug: form.get("slug"),
      city: form.get("city"),
      region: form.get("region"),
      country: form.get("country"),
      countryCode: String(form.get("countryCode")).toUpperCase(),
      title: { en: form.get("titleEn"), zh: form.get("titleZh") },
      sourceUrl: form.get("sourceUrl"),
      sourceProtocol: form.get("sourceProtocol"),
      playbackUrl: form.get("playbackUrl"),
      posterUrl: form.get("posterUrl"),
      latitude: Number(form.get("latitude")),
      longitude: Number(form.get("longitude")),
      timezone: form.get("timezone"),
      primaryChannel,
      channels,
      attribution: { name: form.get("attributionName"), url: form.get("attributionUrl") },
      rightsExpiresAt: rightsDate.toISOString(),
      allowAudio: form.get("allowAudio") === "on",
      allowTranscoding: true,
      allowFrameAnalysis: true,
      allowDerivedMetadata: true,
      maxRetentionHours: Number(form.get("maxRetentionHours")),
    };
    const response = await fetch("/api/v1/admin/feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setStatus(response.ok ? "success" : "error");
    if (response.ok) formElement.reset();
  }

  return (
    <form className="feed-form" onSubmit={submit}>
      <div className="form-section-heading">
        <span>01</span>
        <div><h3>{locale === "en" ? "Signal" : "信号"}</h3><p>SRT, RTMPS, RTSP or HLS</p></div>
      </div>
      <label>Name<input name="name" required minLength={2} /></label>
      <label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="nazare-north-beach" /></label>
      <label>Private source URL<input name="sourceUrl" required inputMode="url" placeholder="srt://…" /></label>
      <label>Protocol<select name="sourceProtocol" defaultValue="srt"><option>srt</option><option>rtmps</option><option>rtsp</option><option>hls</option></select></label>
      <label>Public HLS playback<input name="playbackUrl" required type="url" placeholder="https://…/manifest.m3u8" /></label>
      <label>Verified poster frame<input name="posterUrl" required type="url" placeholder="https://…/thumbnail.jpg" /></label>

      <div className="form-section-heading">
        <span>02</span>
        <div><h3>{locale === "en" ? "Place" : "位置"}</h3><p>Verified physical coordinates</p></div>
      </div>
      <div className="feed-form-pair">
        <label>City<input name="city" required /></label>
        <label>Region<input name="region" required /></label>
      </div>
      <div className="feed-form-pair">
        <label>Country<input name="country" required /></label>
        <label>Country code<input name="countryCode" required maxLength={2} pattern="[A-Za-z]{2}" placeholder="PT" /></label>
      </div>
      <div className="feed-form-pair">
        <label>Latitude<input name="latitude" required type="number" min="-90" max="90" step="any" /></label>
        <label>Longitude<input name="longitude" required type="number" min="-180" max="180" step="any" /></label>
      </div>
      <label>Timezone<input name="timezone" required placeholder="Atlantic/Faroe" /></label>

      <div className="form-section-heading">
        <span>03</span>
        <div><h3>{locale === "en" ? "Edition" : "编排"}</h3><p>Bilingual public metadata</p></div>
      </div>
      <label>English title<input name="titleEn" required maxLength={240} /></label>
      <label>中文标题<input name="titleZh" required maxLength={120} /></label>
      <label>
        Primary channel
        <select
          name="primaryChannel"
          value={primaryChannel}
          onChange={(event) => setPrimaryChannel(event.target.value as SceneChannel)}
        >
          {channels.map((channel) => <option key={channel}>{channel}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Channels</legend>
        {(["storm", "ocean", "night"] as const).map((channel) => (
          <label className="check-label" key={channel}>
            <input checked={channels.includes(channel)} type="checkbox" onChange={() => toggleChannel(channel)} />
            {channel}
          </label>
        ))}
      </fieldset>

      <div className="form-section-heading">
        <span>04</span>
        <div><h3>{locale === "en" ? "Rights" : "授权"}</h3><p>Required before analysis</p></div>
      </div>
      <label>Attribution name<input name="attributionName" required /></label>
      <label>Attribution URL<input name="attributionUrl" required type="url" /></label>
      <label>Rights expire<input name="rightsExpiresAt" required type="datetime-local" /></label>
      <label>Retention<select name="maxRetentionHours" defaultValue="24"><option value="0">No frame retention</option><option value="1">1 hour</option><option value="24">24 hours</option></select></label>
      <label className="check-label"><input name="allowAudio" type="checkbox" /> Audio may be played</label>
      <p className="rights-confirmation">Submitting confirms written rights to transcode, analyse frames and publish derived metadata.</p>
      <button className="form-submit" disabled={channels.length === 0 || status === "submitting"} type="submit">
        {status === "submitting" ? "Validating…" : "Validate & register"}
      </button>
      {status === "success" ? <p className="form-note form-note--success">Source and scene registered for health checks.</p> : null}
      {status === "error" ? <p className="form-note form-note--error">Registration failed. Review the rights and signal fields.</p> : null}
    </form>
  );
}
