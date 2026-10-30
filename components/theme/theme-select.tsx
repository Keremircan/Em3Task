"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { onThemeChange, readTheme, setTheme, type ThemeMode } from "./theme";

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun; hint: string }[] = [
  { mode: "system", label: "Sistem", icon: Monitor, hint: "Cihazın açık/koyu ayarını izler" },
  { mode: "light", label: "Açık", icon: Sun, hint: "Her zaman açık tema" },
  { mode: "dark", label: "Koyu", icon: Moon, hint: "Her zaman koyu tema" },
];

// Profil sayfasındaki tema seçimi (bu cihaz için)
export function ThemeSelect() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const sync = () => setMode(readTheme());
    sync();
    return onThemeChange(sync);
  }, []);

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ mode: m, label, icon: Icon, hint }) => {
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              title={hint}
              onClick={() => setTheme(m)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                on
                  ? "border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">Seçim bu cihazda saklanır. “Sistem”, telefonun ya da bilgisayarın ayarını izler.</p>
    </div>
  );
}
