import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Channel } from "@liveearth/domain/types";
import { ChannelEdition } from "@/components/channel-edition";
import { SiteHeader } from "@/components/site-header";
import { getRankingSnapshot } from "@/lib/data";
import { copy, isLocale } from "@/lib/i18n";

const CHANNELS = ["storm", "ocean", "night"] as const;
export const revalidate = 60;

function isMvpChannel(value: string): value is (typeof CHANNELS)[number] {
  return CHANNELS.includes(value as (typeof CHANNELS)[number]);
}

export function generateStaticParams() {
  return CHANNELS.flatMap((channel) => [
    { locale: "en", channel },
    { locale: "zh", channel },
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; channel: string }>;
}): Promise<Metadata> {
  const { locale, channel } = await params;
  if (!isLocale(locale) || !isMvpChannel(channel)) return {};
  return {
    title: `Live${channel[0]?.toUpperCase()}${channel.slice(1)}`,
    description: copy[locale].channelDescription[channel],
  };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ locale: string; channel: string }>;
}) {
  const { locale, channel } = await params;
  if (!isLocale(locale) || !isMvpChannel(channel)) notFound();
  const snapshot = await getRankingSnapshot(channel);

  return (
    <>
      <SiteHeader locale={locale} transparent={snapshot.entries.length > 0} />
      <main id="main-content">
        <ChannelEdition channel={channel as Exclude<Channel, "earth">} locale={locale} snapshot={snapshot} />
      </main>
    </>
  );
}
