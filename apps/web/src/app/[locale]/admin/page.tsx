import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { SiteHeader } from "@/components/site-header";
import { getAdminContext } from "@/lib/auth";
import { summariseOperations } from "@/lib/admin-summary";
import { getAllScenes } from "@/lib/data";
import { isDemoMode } from "@/lib/demo-mode";
import { isLocale } from "@/lib/i18n";
import type { Scene } from "@liveearth/domain/types";

export const metadata: Metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const demo = isDemoMode();
  let authorised = demo;
  let scenes: Scene[] = [];
  let rightsAlerts = 0;
  let analysisDue = 0;

  if (demo) {
    scenes = await getAllScenes();
  } else {
    const context = await getAdminContext();
    authorised = context.isAdmin;
    if (authorised && context.supabase) {
      const [{ data: sceneRows }, { data: feedRows }] = await Promise.all([
        context.supabase.from("published_scenes").select("payload"),
        context.supabase.from("feeds").select("rights_expires_at"),
      ]);
      scenes = (sceneRows ?? []).map((row) => row.payload as Scene);
      const summary = summariseOperations(scenes, feedRows ?? []);
      analysisDue = summary.analysisDue;
      rightsAlerts = summary.rightsAlerts;
    }
  }

  return (
    <>
      <SiteHeader locale={locale} />
      <main className="admin-page" id="main-content">
        <AdminDashboard
          scenes={scenes}
          locale={locale}
          authorised={authorised}
          analysisDue={analysisDue}
          rightsAlerts={rightsAlerts}
        />
      </main>
    </>
  );
}
