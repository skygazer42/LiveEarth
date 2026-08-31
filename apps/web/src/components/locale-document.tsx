"use client";

import { useEffect, type ReactNode } from "react";
import type { Locale } from "@liveearth/domain/types";

export function LocaleDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return children;
}
