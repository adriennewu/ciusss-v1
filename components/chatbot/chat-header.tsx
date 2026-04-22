"use client"

import { X } from "lucide-react"
import { LanguageToggle } from "./language-toggle"
import { BetaBadge } from "./beta-badge"
import type { ChatLocale } from "./chatbot-copy"

interface ChatHeaderProps {
  locale: ChatLocale
  onLocaleChange: (locale: ChatLocale) => void
  closeAriaLabel: string
  onClose?: () => void
}

export function ChatHeader({
  locale,
  onLocaleChange,
  closeAriaLabel,
  onClose,
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-start md:items-center justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4 bg-primary text-primary-foreground rounded-none md:rounded-t-2xl">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-lg sm:text-xl font-bold tracking-tight">Québec</span>
          <div className="grid grid-cols-2 gap-0.5">
            <div className="w-2 h-2 rounded-sm bg-primary-foreground" />
            <div className="w-2 h-2 rounded-sm bg-primary-foreground" />
            <div className="w-2 h-2 rounded-sm bg-primary-foreground" />
            <div className="w-2 h-2 rounded-sm bg-primary-foreground" />
          </div>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm sm:text-base font-semibold truncate">
              Assistant CIUSSS
            </span>
            <BetaBadge />
          </div>
          <span className="text-xs text-primary-foreground/80">
            Centre-Ouest-de-l&apos;Île-de-Montréal
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
        <LanguageToggle locale={locale} onLocaleChange={onLocaleChange} />
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 transition-colors"
          aria-label={closeAriaLabel}
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </header>
  )
}
