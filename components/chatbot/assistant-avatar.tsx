import { Bot } from "lucide-react"

export function AssistantAvatar() {
  return (
    <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary md:flex">
      <Bot className="w-5 h-5 text-primary-foreground" aria-hidden />
    </div>
  )
}
