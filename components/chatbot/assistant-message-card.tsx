import { cn } from "@/lib/utils"
import { AssistantAvatar } from "./assistant-avatar"
import type { ReactNode } from "react"

interface AssistantMessageCardProps {
  children: ReactNode
  className?: string
  showAvatar?: boolean
  /**
   * V3 read-aloud focus: no avatar column, bubble fills available width/height,
   * message body scrolls inside the bubble when content overflows.
   */
  v3FocusBubble?: boolean
  /** Trailing controls aligned to the top-right, outside the bubble (read-aloud V1). */
  actions?: ReactNode
  /** Read-aloud V2: controls inside the bubble below a divider. */
  footer?: ReactNode
}

export function AssistantMessageCard({
  children,
  className,
  showAvatar = true,
  v3FocusBubble = false,
  actions,
  footer,
}: AssistantMessageCardProps) {
  if (v3FocusBubble) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-none px-4 py-3 shadow-sm sm:px-5 sm:py-4",
            "w-full max-w-none",
            className
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? (
            <div className="mt-3 shrink-0 border-t border-border/80 pt-3">
              {footer}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="shrink-0 self-start pt-0.5">{actions}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 sm:gap-3">
      {showAvatar && <AssistantAvatar />}
      {!showAvatar && <div className="w-10 flex-shrink-0" />}
      <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-2.5">
        <div
          className={cn(
            "bg-card rounded-2xl rounded-tl-none px-4 py-3 sm:px-5 sm:py-4 shadow-sm max-w-[min(90%,32rem)] sm:max-w-[min(90%,36rem)] min-w-0",
            className
          )}
        >
          {children}
          {footer ? (
            <div className="mt-3 border-t border-border/80 pt-3">{footer}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="shrink-0 self-start pt-0.5">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
