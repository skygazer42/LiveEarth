import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountPanel } from "@/components/account-panel";
import { SiteHeader } from "@/components/site-header";
import { getAllScenes } from "@/lib/data";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { title: "Your Earth" };
export const revalidate = 60;

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const scenes = await getAllScenes();

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="account-page" id="main-content">
        <AccountPanel scenes={scenes} locale={locale} />
      </main>
    </>
  );
}
