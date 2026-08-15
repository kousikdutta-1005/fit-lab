/**
 * Light/dark theme state, backed by the `.dark` class on <html> that every
 * shadcn token and every legacy hand-rolled token (--void, --ink, --cyan,
 * etc. in index.css) both key off. Defaults to dark, matching the product's
 * original single-theme appearance, and persists the user's choice.
 */
export type ThemeMode = "light" | "dark"

const STORAGE_KEY = "fitlab-theme"

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "light" || stored === "dark" ? stored : "dark"
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", mode === "dark")
}

export function storeTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, mode)
}
