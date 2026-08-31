import Link from "next/link";
import { RadioTower } from "lucide-react";
import type { Channel, Locale } from "@liveearth/domain/types";
import { copy } from "@/lib/i18n";

export function EmptyChannel({ channel, locale }: { channel: Channel; locale: Locale }) {
  const t = copy[locale];
  return (
    <section className="empty-channel">
      <div className="empty-signal" aria-hidden="true">
        <RadioTower strokeWidth={1} />
        <span />
      </div>
      <div>
        <p className="eyebrow">{channel} · awaiting a verified signal</p>
        <h1>{t.emptyTitle}</h1>
        <p>{t.emptyBody}</p>
        <Link className="text-link" href={`/${locale}`}>
          {t.emptyAction} <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
