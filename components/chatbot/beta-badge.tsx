import type { ChatLocale } from "./chatbot-copy"
import { cn } from "@/lib/utils"

export function BetaBadge({
  locale,
  className,
}: {
  locale: ChatLocale
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-full bg-[var(--beta-badge-bg)] text-[var(--beta-badge-fg)]",
        className,
      )}
    >
      {locale === "en" ? "BETA" : "BÊTA"}
    </span>
  )
}
