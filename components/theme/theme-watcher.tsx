"use client";

import { useEffect } from "react";
import { applyTheme, readTheme } from "./theme";

// "Sistem" seçiliyken cihazın açık/koyu ayarı değişirse temayı anında uygular
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return null;
}
