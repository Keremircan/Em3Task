// Tema: "system" (cihaz ayarı, varsayılan) | "light" | "dark". Seçim tarayıcıda saklanır.
export type ThemeMode = "system" | "light" | "dark";
export const THEME_KEY = "em3task-theme";
const EVENT = "em3task-theme-change";

export function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function isDark(mode: ThemeMode): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark());
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", isDark(mode));
}

export function setTheme(mode: ThemeMode) {
  try {
    if (mode === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch {}
  applyTheme(mode);
  window.dispatchEvent(new Event(EVENT));
}

export function onThemeChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

// Sayfa çizilmeden önce çalışır (açılışta beyaz ekran yanıp sönmesin)
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
