/* Live camera posters come from operator-controlled hosts, so they intentionally bypass Next's fixed image allowlist. */
/* eslint-disable @next/next/no-img-element */

export function SceneImage({
  src,
  alt = "",
  priority = false,
  fit = "cover",
}: {
  src: string;
  alt?: string;
  priority?: boolean;
  fit?: "cover" | "contain";
}) {
  return (
    <img
      alt={alt}
      className="scene-image"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      src={src}
      style={{ objectFit: fit }}
    />
  );
}
