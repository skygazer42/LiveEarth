"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, LogOut, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import type { Locale, Scene } from "@liveearth/domain/types";
import { copy } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useFavorites } from "./favorites-provider";
import { SceneImage } from "./scene-image";

export function AccountPanel({ scenes, locale }: { scenes: Scene[]; locale: Locale }) {
  const t = copy[locale].account;
  const { favorites, history, clearHistory, clearAll, hydrated, mergeRemote } = useFavorites();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [deleteState, setDeleteState] = useState<"idle" | "confirming" | "deleting" | "error">(
    "idle",
  );
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const syncedUserId = useRef<string | null>(null);
  const sceneMap = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);
  const savedScenes = favorites.map((id) => sceneMap.get(id)).filter(isScene);
  const recentScenes = history.map((id) => sceneMap.get(id)).filter(isScene).slice(0, 6);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user || syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;
    async function syncLibrary() {
      await Promise.all([
        fetch("/api/v1/me/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sceneIds: favorites }),
        }),
        fetch("/api/v1/me/history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sceneIds: history }),
        }),
      ]);
      const [favoriteResponse, historyResponse] = await Promise.all([
        fetch("/api/v1/me/favorites"),
        fetch("/api/v1/me/history"),
      ]);
      if (!favoriteResponse.ok || !historyResponse.ok) return;
      const remoteFavorites = (await favoriteResponse.json()) as { sceneIds: string[] };
      const remoteHistory = (await historyResponse.json()) as { sceneIds: string[] };
      mergeRemote(remoteFavorites.sceneIds, remoteHistory.sceneIds);
    }
    void syncLibrary().catch(() => {
      syncedUserId.current = null;
    });
  }, [favorites, history, mergeRemote, user]);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !email) return;
    setStatus("sending");
    const redirectTo = `${window.location.origin}/auth/callback?next=/${locale}/favorites`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setStatus(error ? "error" : "sent");
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/favorites` },
    });
  }

  async function signOut() {
    if (!supabase) return;
    clearAll();
    syncedUserId.current = null;
    await supabase.auth.signOut();
  }

  async function deleteAccount() {
    if (!supabase || (deleteState !== "confirming" && deleteState !== "error")) return;
    setDeleteState("deleting");
    const response = await fetch("/api/v1/me", { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setDeleteState("error");
      return;
    }
    clearAll();
    syncedUserId.current = null;
    await supabase.auth.signOut({ scope: "local" });
    router.replace(`/${locale}`);
    router.refresh();
  }

  return (
    <div className="account-layout">
      <section className="account-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.body}</p>

        {user ? (
          <div className="signed-in-state">
            <span><Check aria-hidden="true" /> {user.email}</span>
            <div className="signed-in-actions">
              {deleteState !== "idle" ? (
                <div className="delete-confirmation" role="group" aria-label={t.deleteAccount}>
                  <p>{deleteState === "error" ? t.deleteError : t.deleteConfirm}</p>
                  <button
                    className="danger-action"
                    type="button"
                    disabled={deleteState === "deleting"}
                    onClick={() => void deleteAccount()}
                  >
                    <Trash2 aria-hidden="true" size={14} />
                    {deleteState === "deleting" ? t.deleting : t.deleteNow}
                  </button>
                  <button
                    type="button"
                    disabled={deleteState === "deleting"}
                    onClick={() => setDeleteState("idle")}
                  >
                    <X aria-hidden="true" size={14} /> {t.cancel}
                  </button>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => void signOut()}>
                    <LogOut aria-hidden="true" size={15} /> {t.signOut}
                  </button>
                  <button
                    className="delete-trigger"
                    type="button"
                    onClick={() => setDeleteState("confirming")}
                  >
                    <Trash2 aria-hidden="true" size={14} /> {t.deleteAccount}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="account-auth">
            <form onSubmit={sendMagicLink}>
              <label htmlFor="account-email">{t.email}</label>
              <div>
                <input
                  id="account-email"
                  type="email"
                  value={email}
                  required
                  autoComplete="email"
                  disabled={!supabase}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button type="submit" disabled={!supabase || status === "sending"}>{t.magic}</button>
              </div>
            </form>
            <button className="google-button" type="button" disabled={!supabase} onClick={() => void signInWithGoogle()}>
              <span aria-hidden="true">G</span> {t.google}
            </button>
            {!supabase ? <p className="form-note">{t.unavailable}</p> : null}
            {status === "sent" ? <p className="form-note form-note--success">Check your inbox.</p> : null}
            {status === "error" ? <p className="form-note form-note--error">Could not send the link. Try again.</p> : null}
          </div>
        )}
      </section>

      <section className="library-section">
        <div className="library-heading">
          <h2>{t.saved}</h2>
          <span>{hydrated ? String(savedScenes.length).padStart(2, "0") : "—"}</span>
        </div>
        {savedScenes.length > 0 ? (
          <SceneLibrary scenes={savedScenes} locale={locale} />
        ) : (
          <p className="library-empty">{t.none}</p>
        )}
      </section>

      <section className="library-section library-section--recent">
        <div className="library-heading">
          <h2>{t.recent}</h2>
          <button type="button" onClick={clearHistory}>{t.clear}</button>
        </div>
        {recentScenes.length > 0 ? <SceneLibrary scenes={recentScenes} locale={locale} compact /> : null}
      </section>
    </div>
  );
}

function SceneLibrary({ scenes, locale, compact = false }: { scenes: Scene[]; locale: Locale; compact?: boolean }) {
  return (
    <div className={`scene-library${compact ? " scene-library--compact" : ""}`}>
      {scenes.map((scene, index) => (
        <Link href={`/${locale}/scene/${scene.slug}`} key={scene.id}>
          <div className="library-image">
            <SceneImage src={scene.media.posterUrl} />
            <span>{String(index + 1).padStart(2, "0")}</span>
          </div>
          <p>{scene.country}</p>
          <h3>{scene.city} <ArrowUpRight aria-hidden="true" size={16} /></h3>
          {compact ? null : <p>{scene.analysis.reason[locale]}</p>}
        </Link>
      ))}
    </div>
  );
}

function isScene(value: Scene | undefined): value is Scene {
  return value !== undefined;
}
