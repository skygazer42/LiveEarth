"use client";

import { Bookmark, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@liveearth/domain/types";
import { copy } from "@/lib/i18n";

export function SiteHeader({ locale, transparent = false }: { locale: Locale; transparent?: boolean }) {
  const t = copy[locale];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const otherLocale = locale === "en" ? "zh" : "en";
  const localePath = pathname.replace(/^\/(en|zh)(?=\/|$)/, `/${otherLocale}`);
  const links = [
    { href: `/${locale}`, label: t.nav.top },
    { href: `/${locale}/channel/storm`, label: t.nav.storm },
    { href: `/${locale}/channel/ocean`, label: t.nav.ocean },
    { href: `/${locale}/channel/night`, label: t.nav.night },
  ];

  return (
    <header className={`site-header${transparent ? " site-header--transparent" : ""}`}>
      <Link className="brand" href={`/${locale}`} aria-label={`${t.product} — ${t.tagline}`}>
        <span className="brand-orbit" aria-hidden="true">
          <span />
        </span>
        <span>{t.product}</span>
      </Link>

      <nav className={`primary-nav${open ? " primary-nav--open" : ""}`} aria-label="Primary">
        {links.map((link) => (
          <Link
            aria-current={pathname === link.href ? "page" : undefined}
            href={link.href}
            key={link.href}
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="header-tools">
        <Link className="saved-link" href={`/${locale}/favorites`} aria-label={t.nav.saved}>
          <Bookmark aria-hidden="true" size={16} strokeWidth={1.6} />
          <span>{t.nav.saved}</span>
        </Link>
        <Link className="locale-link" href={localePath} hrefLang={otherLocale}>
          {locale === "en" ? "中" : "EN"}
        </Link>
        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
