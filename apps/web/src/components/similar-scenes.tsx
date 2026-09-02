import Link from "next/link";
import type { Locale, Scene } from "@liveearth/domain/types";
import { channelLabel } from "@/lib/format";
import { SceneImage } from "./scene-image";

export function SimilarScenes({ scenes, locale }: { scenes: Scene[]; locale: Locale }) {
  return (
    <div className="similar-grid">
      {scenes.map((scene, index) => (
        <Link className="similar-scene" href={`/${locale}/scene/${scene.slug}`} key={scene.id}>
          <div className="similar-image">
            <SceneImage fit={scene.media.fit ?? "cover"} src={scene.media.posterUrl} />
            <span>{String(index + 1).padStart(2, "0")}</span>
          </div>
          <p>{scene.country} · {channelLabel(scene.primaryChannel, locale)}</p>
          <h3>{scene.city}</h3>
          <p>{scene.title[locale]}</p>
        </Link>
      ))}
    </div>
  );
}
