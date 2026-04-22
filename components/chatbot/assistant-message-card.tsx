import { cn } from "@/lib/utils"
import { AssistantAvatar } from "./assistant-avatar"
import type { ReactNode } from "react"

interface AssistantMessageCardProps {
  children: ReactNode
  className?: string
  showAvatar?: boolean
  /** Trailing controls aligned to the top-right, outside the bubble (read-aloud V1). */
  actions?: ReactNode
  /** Read-aloud V2: controls inside the bubble below a divider. */
  footer?: ReactNode
}

export function AssistantMessageCard({
  children,
  className,
  showAvatar = true,
  actions,
  footer,
}: AssistantMessageCardProps) {
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
