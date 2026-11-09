export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "daymemory-theme";
const THEME_COLORS = { light: "#ffffff", dark: "#0e1013" } as const;

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.dataset.default ??= meta.content;
    meta.content = theme === "system" ? meta.dataset.default : THEME_COLORS[theme];
  });
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
  applyTheme(theme);
}