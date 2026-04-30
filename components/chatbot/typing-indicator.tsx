"use client"

import { cn } from "@/lib/utils"
import { AssistantAvatar } from "./assistant-avatar"
import { LoadingDots } from "./loading-dots"

interface TypingIndicatorProps {
  showAvatar?: boolean
  tallBubble?: boolean
  /** Visible / SR text for the typing state (also used inside the live region). */
  statusText: string
  className?: string
}

export function TypingIndicator({
  showAvatar = false,
  tallBubble = false,
  statusText,
  className,
}: TypingIndicatorProps) {
  return (
    <div className={cn("flex items-start gap-2 sm:gap-3", className)}>
      {showAvatar ? (
        <AssistantAvatar />
      ) : (
        <div className="w-10 flex-shrink-0" aria-hidden />
      )}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex min-w-0 flex-col gap-1"
      >
        <span className="sr-only">{statusText}</span>
        <LoadingDots variant="assistant" tall={tallBubble} />
      </div>
    </div>
  )
}
