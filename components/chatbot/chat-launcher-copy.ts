import type { ChatLocale } from "./chatbot-copy"

/** French helper text for the launcher tooltip (warm, short). */
export const CHAT_LAUNCHER_TOOLTIP_FR =
  "Besoin d’aide pour trouver des informations ?\nJe suis là pour vous aider."

export const CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA_FR = "Fermer l’aide"

/** English helper text for the launcher tooltip. */
export const CHAT_LAUNCHER_TOOLTIP_EN =
  "Need help finding information?\nI'm here to help."

export const CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA_EN = "Dismiss help"

/** @deprecated kept for back-compat; prefer `getChatLauncherTooltipCopy(locale)`. */
export const CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA =
  CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA_FR

export interface ChatLauncherTooltipCopy {
  message: string
  dismissAriaLabel: string
}

/** Tooltip copy reflects the host *website* language, not the widget's internal toggle. */
export function getChatLauncherTooltipCopy(
  locale: ChatLocale
): ChatLauncherTooltipCopy {
  if (locale === "en") {
    return {
      message: CHAT_LAUNCHER_TOOLTIP_EN,
      dismissAriaLabel: CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA_EN,
    }
  }
  return {
    message: CHAT_LAUNCHER_TOOLTIP_FR,
    dismissAriaLabel: CHAT_LAUNCHER_TOOLTIP_DISMISS_ARIA_FR,
  }
}
