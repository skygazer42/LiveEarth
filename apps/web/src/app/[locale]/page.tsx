import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveStage } from "@/components/live-stage";
import { SiteHeader } from "@/components/site-header";
import { getRankingSnapshot } from "@/lib/data";
import { copy, isLocale } from "@/lib/i18n";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: locale === "en" ? "Earth Top Now" : "此刻地球榜",
    description: copy[locale].channelDescription.earth,
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const snapshot = await getRankingSnapshot("earth");

  return (
    <>
      <SiteHeader locale={locale} transparent />
      <main id="main-content" className="home-main">
        <LiveStage snapshot={snapshot} locale={locale} />
      </main>
    </>
  );
}
