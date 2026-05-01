"use client"

import { cn } from "@/lib/utils"

export type LoadingDotsVariant = "assistant" | "userBubble"

interface LoadingDotsProps {
  variant?: LoadingDotsVariant
  className?: string
  /** For assistant variant inside bordered pill */
  tall?: boolean
}

const variantClasses: Record<LoadingDotsVariant, { wrap: string; dot: string }> = {
  assistant: {
    wrap: "inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 shadow-sm py-1.5",
    dot: "bg-primary-on-background",
  },
  userBubble: {
    wrap: "inline-flex items-center gap-1 py-0.5",
    dot: "bg-primary-foreground/90",
  },
}

export function LoadingDots({
  variant = "assistant",
  className,
  tall = false,
}: LoadingDotsProps) {
  const v = variantClasses[variant]
  return (
    <div
      className={cn(
        v.wrap,
        tall && variant === "assistant" && "min-h-10 px-4 items-center py-0",
        className
      )}
      aria-hidden
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full motion-safe:animate-bounce", v.dot)}
        style={{ animationDelay: "0ms" }}
      />
      <span
        className={cn("w-1.5 h-1.5 rounded-full motion-safe:animate-bounce", v.dot)}
        style={{ animationDelay: "150ms" }}
      />
      <span
        className={cn("w-1.5 h-1.5 rounded-full motion-safe:animate-bounce", v.dot)}
        style={{ animationDelay: "300ms" }}
      />
    </div>
  )
}
