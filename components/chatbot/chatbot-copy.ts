import type { SourcesPlacement } from "./prototype-config"

export type ChatLocale = "fr" | "en"

export interface SuggestionDef {
  id: string
  label: string
}

export interface SourceLinkDef {
  title: string
  url: string
}

export interface ChatCopy {
  greeting: { line1: string; line2: string; disclaimer: string }
  userServicesQuestion: string
  assistantFirst: {
    intro: string
    bullets: string[]
  }
  sourcesHeading: string
  sourcesInline: SourceLinkDef[]
  /** Short label for the collapsible sources trigger (count appended in UI). */
  sourcesCollapsibleLabel: string
  v3: { intro: string; links: SourceLinkDef[] }
  /** V4: inline sources as a sentence around the same URLs as `v3.links`. */
  v4: {
    servicesSourcesBeforeFirstLink: string
    servicesSourcesBetweenLinks: string
    servicesSourcesAfterLastLink: string
  }
  assistantFollowUp: string
  initialSuggestions: SuggestionDef[]
  followUpSuggestions: SuggestionDef[]
  composerPlaceholder: string
  composerSendLabel: string
  /** Visible label next to the mic icon (e.g. Voice / Voix). */
  composerMicLabel: string
  composerMicAriaLabel: string
  composerTranscriptionLoadingPlaceholder: string
  voiceRecordingCancelAriaLabel: string
  voiceRecordingConfirmAriaLabel: string
  typingIndicatorAriaLabel: string
  closeAriaLabel: string
  betaDisclaimerBanner: string
  voiceCaptureErrorBanner: string
  notificationBannerDismissAria: string
  /** Server-side STT (MediaRecorder / iOS path). */
  voiceServerTranscriptionFailed: string
  voiceServerNotConfigured: string
  voiceRecordingTooShort: string
  voiceNoSpeechRecognized: string
  /** Browser dictation: nothing recognized in the UI language (try matching the toggle or server dictation). */
  voiceWebSpeechNoMatch: string
  /** Floating control to scroll the chat body to the latest messages. */
  scrollDownLabel: string
  /** SGQRI 008 / FAB: launcher when chat is closed */
  launcherFabAriaLabel: string
  /** Accessible name for the message field (not placeholder alone). */
  composerInputAriaLabel: string
  /** Prefix for suggestion chip `aria-label` (full chip text appended). */
  suggestionChipAriaPrefix: string
  /** Announced when the combined send/mic control is in send mode (optional live region). */
  composerSendModeAnnouncement: string
  /** Announced when the combined send/mic control is in voice mode (optional live region). */
  composerVoiceModeAnnouncement: string
  /** When the primary action control is disabled (e.g. busy with empty draft). */
  composerPrimaryActionUnavailableAriaLabel: string
}

export function getSuggestionChipAriaLabel(
  copy: ChatCopy,
  chipLabel: string
): string {
  return `${copy.suggestionChipAriaPrefix}${chipLabel}`
}

const fr: ChatCopy = {
  greeting: {
    line1: "Bonjour ! 👋 Je suis votre **Assistant CIUSSS**.",
    line2:
      "Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions sur nos **services**, nos **cliniques**, et bien plus.",
    disclaimer:
      "⚠️ Cependant je ne suis pas en mesure de fournir des recommandations médicales et je ne pourrai pas prendre rendez-vous automatiquement pour vous.",
  },
  userServicesQuestion: "Quels services offrez-vous ?",
  assistantFirst: {
    intro:
      "Nous offrons un **continuum complet de soins de santé et de services sociaux** à la population du territoire, au sein de plus de **30 installations**. Voici les principaux types de services mentionnés sur le site :",
    bullets: [
      "**Hôpital général** : notamment l'Hôpital général juif",
      "**Hôpitaux spécialisés** : 3 établissements spécialisés",
      "**CLSC** : 5 CLSC et 1 point de service",
      "**Centres de réadaptation** : 2 centres",
      "**CHSLD / hébergement de longue durée** : 6 centres",
      "**Centres de jour** : 2 centres",
      "**Maisons bleues**",
      "**Maison de naissance**",
      "**Ressources intermédiaires**",
      "**Info-Santé / Info-Social 811**",
      "**Recherche et enseignement** : plusieurs centres de recherche affiliés",
    ],
  },
  sourcesHeading: "Sources :",
  sourcesCollapsibleLabel: "Sources",
  sourcesInline: [
    { title: "Page d'accueil du CIUSSS", url: "#" },
    { title: "Programmes et services", url: "#" },
  ],
  v4: {
    servicesSourcesBeforeFirstLink:
      "Vous pouvez explorer la liste complète des programmes et services sur ",
    servicesSourcesBetweenLinks: " et ",
    servicesSourcesAfterLastLink: ".",
  },
  v3: {
    intro:
      "Vous pouvez aussi explorer les sections de services et d'installations ici :",
    links: [
      {
        title: "Page d'accueil du CIUSSS",
        url: "https://www.ciussscentreouest.ca/",
      },
      {
        title: "Notre CIUSSS",
        url: "https://www.ciussscentreouest.ca/a-propos-du-ciusss/notre-ciusss",
      },
    ],
  },
  assistantFollowUp:
    "Si vous voulez, je peux aussi vous donner la **liste détaillée des services par catégorie** ou les **adresses de chaque point de service**.",
  initialSuggestions: [
    { id: "services", label: "Quels services offrez-vous ?" },
    { id: "appointment", label: "Comment prendre rendez-vous ?" },
    { id: "clinics", label: "Où sont situées vos cliniques ?" },
  ],
  followUpSuggestions: [
    { id: "detail_list", label: "Liste détaillée des services par catégorie" },
    { id: "addresses", label: "Adresses de chaque point de service" },
  ],
  composerPlaceholder: "Posez votre question...",
  composerSendLabel: "Envoyer le message",
  composerMicLabel: "Voix",
  composerMicAriaLabel: "Enregistrer un message vocal",
  composerTranscriptionLoadingPlaceholder: "Transcription en cours…",
  voiceRecordingCancelAriaLabel: "Annuler l'enregistrement",
  voiceRecordingConfirmAriaLabel: "Confirmer la dictée",
  typingIndicatorAriaLabel: "L'assistant est en train d'écrire…",
  closeAriaLabel: "Fermer le clavardage",
  betaDisclaimerBanner:
    "Cet assistant est en version bêta. Les réponses peuvent comporter des erreurs.",
  voiceCaptureErrorBanner:
    "Nous n'avons pas pu capter votre audio. Veuillez vérifier que votre microphone est activé, puis réessayez.",
  notificationBannerDismissAria: "Fermer l'avis",
  voiceServerTranscriptionFailed:
    "La transcription n'a pas pu être effectuée. Réessayez.",
  voiceServerNotConfigured:
    "La dictée sur serveur n'est pas configurée (clé API manquante).",
  voiceRecordingTooShort: "Enregistrement trop court. Réessayez.",
  voiceNoSpeechRecognized:
    "Aucune parole n'a été reconnue. Veuillez réessayer.",
  voiceWebSpeechNoMatch:
    "Aucune parole reconnue dans la langue de l'interface. Si vous parlez dans une autre langue, changez le bouton FR/EN ou configurez la dictée serveur (clé OpenAI).",
  scrollDownLabel: "Défiler vers le bas",
  launcherFabAriaLabel: "Ouvrir l'assistant de clavardage",
  composerInputAriaLabel: "Tapez votre message",
  suggestionChipAriaPrefix: "Question suggérée : ",
  composerSendModeAnnouncement: "Mode envoi actif",
  composerVoiceModeAnnouncement: "Mode enregistrement vocal actif",
  composerPrimaryActionUnavailableAriaLabel:
    "Action indisponible pour le moment, veuillez patienter",
}

const en: ChatCopy = {
  greeting: {
    line1: "Hello! 👋 I'm your **CIUSSS Assistant**.",
    line2:
      "How can I help you today? You can ask me about our **services**, **clinics**, and more.",
    disclaimer:
      "⚠️ However, I cannot provide medical advice and I cannot book appointments for you automatically.",
  },
  userServicesQuestion: "What services do you offer?",
  assistantFirst: {
    intro:
      "We offer a **full continuum of health and social services** for people across the territory, in more than **30 facilities**. Here are the main types of services mentioned on the site:",
    bullets: [
      "**General hospital**: including the Jewish General Hospital",
      "**Specialized hospitals**: 3 specialized facilities",
      "**CLSC**: 5 CLSCs and 1 service point",
      "**Rehabilitation centres**: 2 centres",
      "**CHSLD / long-term care**: 6 centres",
      "**Day centres**: 2 centres",
      "**Maisons bleues**",
      "**Birth centre**",
      "**Intermediate resources**",
      "**Info-Santé / Info-Social 811**",
      "**Research and teaching**: several affiliated research centres",
    ],
  },
  sourcesHeading: "Sources:",
  sourcesCollapsibleLabel: "Sources",
  sourcesInline: [
    { title: "CIUSSS home page", url: "#" },
    { title: "Programs and services", url: "#" },
  ],
  v4: {
    servicesSourcesBeforeFirstLink:
      "You can explore the full list of programs and services at ",
    servicesSourcesBetweenLinks: " and ",
    servicesSourcesAfterLastLink: ".",
  },
  v3: {
    intro:
      "You can also explore services and facility sections here:",
    links: [
      {
        title: "CIUSSS home page",
        url: "https://www.ciussscentreouest.ca/",
      },
      {
        title: "Our CIUSSS",
        url: "https://www.ciussscentreouest.ca/a-propos-du-ciusss/notre-ciusss",
      },
    ],
  },
  assistantFollowUp:
    "If you'd like, I can also share a **detailed list of services by category** or the **address of each service point**.",
  initialSuggestions: [
    { id: "services", label: "What services do you offer?" },
    { id: "appointment", label: "How do I book an appointment?" },
    { id: "clinics", label: "Where are your clinics located?" },
  ],
  followUpSuggestions: [
    { id: "detail_list", label: "Detailed list of services by category" },
    { id: "addresses", label: "Address of each service point" },
  ],
  composerPlaceholder: "Ask your question...",
  composerSendLabel: "Send message",
  composerMicLabel: "Voice",
  composerMicAriaLabel: "Record audio",
  composerTranscriptionLoadingPlaceholder: "Transcription in progress…",
  voiceRecordingCancelAriaLabel: "Cancel recording",
  voiceRecordingConfirmAriaLabel: "Confirm dictation",
  typingIndicatorAriaLabel: "Assistant is typing…",
  closeAriaLabel: "Close chat",
  betaDisclaimerBanner:
    "This assistant is in beta. Responses may contain errors.",
  voiceCaptureErrorBanner:
    "We couldn't capture your audio. Please check that your microphone is enabled, then try again.",
  notificationBannerDismissAria: "Dismiss notice",
  voiceServerTranscriptionFailed:
    "Transcription could not be completed. Please try again.",
  voiceServerNotConfigured:
    "Server dictation is not configured (missing API key).",
  voiceRecordingTooShort: "Recording was too short. Please try again.",
  voiceNoSpeechRecognized: "No speech was recognized. Please try again.",
  voiceWebSpeechNoMatch:
    "No speech was recognized in the interface language. If you spoke another language, switch the FR/EN toggle or set up server dictation (OpenAI API key).",
  scrollDownLabel: "Scroll down",
  launcherFabAriaLabel: "Open chat assistant",
  composerInputAriaLabel: "Type your message",
  suggestionChipAriaPrefix: "Suggested question: ",
  composerSendModeAnnouncement: "Send mode active",
  composerVoiceModeAnnouncement: "Voice recording mode active",
  composerPrimaryActionUnavailableAriaLabel:
    "Action unavailable right now, please wait",
}

export function getChatCopy(locale: ChatLocale): ChatCopy {
  return locale === "en" ? en : fr
}

/** Plain text for progressive streaming (intro + bullets only; sources are rendered as UI). */
export function getAssistantFirstPlainText(
  copy: ChatCopy,
  _placement: SourcesPlacement
): string {
  const lines: string[] = [copy.assistantFirst.intro]
  for (const b of copy.assistantFirst.bullets) {
    lines.push(`• ${b}`)
  }
  return lines.join("\n")
}

export function getV3PlainText(copy: ChatCopy): string {
  const lines = [copy.v3.intro]
  for (const link of copy.v3.links) {
    lines.push(`• ${link.title}`)
  }
  return lines.join("\n")
}

export function getAssistantSecondPlainText(copy: ChatCopy): string {
  return copy.assistantFollowUp
}

export function splitProgressiveChunks(fullText: string): string[] {
  if (!fullText) return []
  return fullText.split("\n")
}
