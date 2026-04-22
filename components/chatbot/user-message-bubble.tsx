import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface UserMessageBubbleProps {
  children: ReactNode
  className?: string
}

export function UserMessageBubble({ children, className }: UserMessageBubbleProps) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 sm:px-5 shadow-sm max-w-[min(85%,20rem)] sm:max-w-[min(75%,28rem)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
