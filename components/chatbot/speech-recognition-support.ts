import type { ChatLocale } from "./chatbot-copy"

export function getSpeechRecognitionConstructor():
  | (new () => SpeechRecognition)
  | null {
  if (typeof window === "undefined") return null
  const w = window as Window & { SpeechRecognition?: new () => SpeechRecognition }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() != null
}

export function speechRecognitionLang(locale: ChatLocale): string {
  return locale === "fr" ? "fr-FR" : "en-US"
}

export function oppositeChatLocale(locale: ChatLocale): ChatLocale {
  return locale === "fr" ? "en" : "fr"
}
