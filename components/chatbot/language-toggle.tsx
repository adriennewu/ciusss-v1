"use client"

import { cn } from "@/lib/utils"
import type { ChatLocale } from "./chatbot-copy"

interface LanguageToggleProps {
  locale: ChatLocale
  onLocaleChange: (locale: ChatLocale) => void
}

export function LanguageToggle({ locale, onLocaleChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center rounded-full bg-primary-foreground/20 p-0.5">
      <button
        type="button"
        className={cn(
          "px-3 py-1 text-sm font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
          locale === "fr"
            ? "bg-white text-black"
            : "text-primary-foreground hover:bg-primary-foreground/10"
        )}
        aria-pressed={locale === "fr"}
        aria-label="Français"
        onClick={() => onLocaleChange("fr")}
      >
        FR
      </button>
      <button
        type="button"
        className={cn(
          "px-3 py-1 text-sm font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
          locale === "en"
            ? "bg-white text-black"
            : "text-primary-foreground hover:bg-primary-foreground/10"
        )}
        aria-pressed={locale === "en"}
        aria-label="English"
        onClick={() => onLocaleChange("en")}
      >
        EN
      </button>
    </div>
  )
}
