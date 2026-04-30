"use client"

import { cn } from "@/lib/utils"
import type { SuggestionDef } from "./chatbot-copy"

interface SuggestionChipsProps {
  suggestions: SuggestionDef[]
  onSelect?: (suggestionId: string) => void
  /** Full accessible name per chip (e.g. prefix + label). */
  getChipAriaLabel: (suggestion: SuggestionDef) => string
  className?: string
}

export function SuggestionChips({
  suggestions,
  onSelect,
  getChipAriaLabel,
  className,
}: SuggestionChipsProps) {
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect?.(s.id)}
          aria-label={getChipAriaLabel(s)}
          className="rounded-full border border-primary-on-background/40 bg-card px-4 py-2 text-sm font-medium text-primary-on-background shadow-sm transition-colors hover:border-primary-on-background/55 hover:bg-primary-on-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
