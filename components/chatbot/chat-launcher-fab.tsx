"use client"

import { forwardRef } from "react"
import { Bot } from "lucide-react"

export interface ChatLauncherFabProps {
  onOpen: () => void
  ariaLabel: string
}

/** Same Bot + primary styling tokens as AssistantAvatar; larger touch target for FAB. */
export const ChatLauncherFab = forwardRef<HTMLButtonElement, ChatLauncherFabProps>(
  function ChatLauncherFab({ onOpen, ariaLabel }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        aria-label={ariaLabel}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/20 transition-[transform,box-shadow] hover:scale-[1.03] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Bot className="h-5 w-5" aria-hidden />
      </button>
    )
  }
)
