import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from "../lib/theme"

/**
 * Light/dark toggle. Rendered inline in each stage's own header (not a
 * global fixed overlay), because a fixed corner position collided with
 * existing per-screen header content (the result screen's "Start again",
 * the intro/stage kickers). 44px tap target per the app's accessibility
 * floor (shadcn's own "icon" button size is 36px, so this is sized up
 * explicitly rather than left at the default).
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark")

  useEffect(() => {
    const stored = getStoredTheme()
    setMode(stored)
    applyTheme(stored)
  }, [])

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark"
    setMode(next)
    applyTheme(next)
    storeTheme(next)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="theme-toggle !h-11 !w-11 shrink-0"
          aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggle}
        >
          <span aria-hidden="true">{mode === "dark" ? "☀︎" : "☾"}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}</TooltipContent>
    </Tooltip>
  )
}
