"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { CircleAlert, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

function useMessageWrapsToMultipleLines(message: string) {
  const rootRef = useRef<HTMLDivElement>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const [wraps, setWraps] = useState(false)

  useLayoutEffect(() => {
    const messageEl = messageRef.current
    if (!messageEl) return

    const measure = () => {
      const el = messageRef.current
      if (!el) return

      if (!el.textContent?.trim()) {
        setWraps(false)
        return
      }

      const style = getComputedStyle(el)
      const fontSize = parseFloat(style.fontSize) || 16
      let lineHeightPx = parseFloat(style.lineHeight)
      if (Number.isNaN(lineHeightPx) || style.lineHeight === "normal") {
        lineHeightPx = fontSize * 1.375
      }

      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0 && r.height > 0,
      )

      let multi = false
      if (rects.length > 0) {
        const first = rects[0]
        const last = rects[rects.length - 1]
        const lineDelta = last.top - first.top
        const blockSpan = last.bottom - first.top
        multi =
          lineDelta > 2 || blockSpan > lineHeightPx * 1.45
      } else {
        multi = el.scrollHeight > lineHeightPx * 1.25
      }

      setWraps(multi)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(messageEl)
    const root = rootRef.current
    if (root) ro.observe(root)

    return () => ro.disconnect()
  }, [message])

  return { rootRef, messageRef, wraps }
}

export interface NotificationBannerProps {
  message: string
  onDismiss: () => void
  variant: "beta" | "error"
  dismissAriaLabel: string
}

export function NotificationBanner({
  message,
  onDismiss,
  variant,
  dismissAriaLabel,
}: NotificationBannerProps) {
  const { rootRef, messageRef, wraps } = useMessageWrapsToMultipleLines(message)

  return (
    <div
      ref={rootRef}
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "flex h-fit w-full justify-start gap-3 rounded-none border-x-0 border-y px-[20px] py-3 text-base leading-normal",
        wraps ? "items-start" : "items-center",
        variant === "beta" &&
          "border-amber-300 bg-amber-50 text-foreground dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-white",
        variant === "error" &&
          "border-destructive/25 bg-destructive/10 text-foreground dark:text-foreground",
      )}
    >
      <p
        ref={messageRef}
        className="order-2 min-w-0 flex-1 text-pretty text-left text-base leading-normal"
      >
        {message}
      </p>
      {variant === "beta" ? (
        <span className="order-1 shrink-0 text-current" aria-hidden>
          <Info className="h-5 w-5" strokeWidth={2} />
        </span>
      ) : null}
      {variant === "error" ? (
        <span className="order-1 shrink-0 text-black dark:text-white" aria-hidden>
          <CircleAlert className="h-5 w-5" strokeWidth={2} />
        </span>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissAriaLabel}
        className={cn(
          "order-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          variant === "beta" &&
            "bg-amber-950/10 text-foreground hover:bg-amber-950/20 focus-visible:ring-amber-950/35 focus-visible:ring-offset-amber-50 dark:bg-white/15 dark:text-white dark:hover:bg-white/25 dark:focus-visible:ring-white/40 dark:focus-visible:ring-offset-amber-950/80",
          variant === "error" &&
            "bg-destructive/10 text-foreground hover:bg-destructive/20 focus-visible:ring-destructive/40 focus-visible:ring-offset-background",
        )}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
