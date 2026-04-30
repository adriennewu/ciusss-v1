export interface InferLocaleFromTextOptions {
  /**
   * When the UI is English, Web Speech (`en-US`) often transcribes French as English-looking
   * tokens with inflated English function-word counts — bias toward French cues.
   */
  uiLocale?: "en" | "fr"
}

/** Heuristic FR/EN from transcript (used by Web Speech without Whisper, and to nudge Whisper). */
export function inferLocaleFromText(
  text: string,
  options?: InferLocaleFromTextOptions
): "en" | "fr" | null {
  const biasFrenchWhenUiEnglish = options?.uiLocale === "en"
  const biasEnglishWhenUiFrench = options?.uiLocale === "fr"
  const t = text.trim()
  if (t.length < 4) return null
  if (/[àâäéèêëïîôùûüÿæœç]/i.test(t)) return "fr"
  const lower = t.toLowerCase()

  if (biasFrenchWhenUiEnglish) {
    const frMicro =
      /\b(oui|non|très|tres|comment|pourquoi|combien|pardon|merci|bonjour|bonsoir|désolé|desole|médecin|medecin|hôpital|hopital|rendez)\b/i.test(
        lower
      ) ||
      /\bs'il vous plait\b/i.test(lower) ||
      /\bs'il vous plaît\b/i.test(lower) ||
      /\bc['’]est\b/.test(lower) ||
      /\bj['’]ai\b/.test(lower) ||
      /\bj['’]arrive\b/.test(lower) ||
      /\bn['’](?:est|y|ai)\b/.test(lower) ||
      /\bqu['’](?:est|il|elle|on)\b/.test(lower) ||
      /\bparce que\b/.test(lower) ||
      /\bje suis\b/.test(lower) ||
      /\bje veux\b/.test(lower) ||
      /\bje voudrais\b/.test(lower) ||
      /\bnous avons\b/.test(lower) ||
      /\bavez-vous\b/.test(lower)
    if (frMicro) return "fr"
  }

  if (biasEnglishWhenUiFrench) {
    const enMicro =
      /\b(hello|hi there|hi\b|thanks|thank you|please|sorry|excuse me|could you|would you|hospital|appointment|doctor|nurse|english|need help|good morning|good afternoon)\b/i.test(
        lower
      ) ||
      /\bwhat\s+(is|are|was|were|do|does|did|can|could|would)\b/.test(lower) ||
      /\b(how do|how can|how are)\b/.test(lower) ||
      /\b(i'm|i am|i have|i need|i want|we need|we are|let me)\b/.test(lower)
    if (enMicro) return "en"
  }

  const frStrong =
    /\b(bonjour|bonsoir|merci|beaucoup|monsieur|madame|mademoiselle|aujourd'hui|aujourd’hui|français|francais|voici|voilà|voila|s'il vous plaît|s'il vous plait|sil vous plait|chus|pis|toune|ouvert|fermé|ferme|rendez-vous|rendez vous)\b/i
  const enStrong =
    /\b(hello|hi there|thanks|thank you|please|could you|would you|what is|what are|how do|how can|this is|that is|your appointment|the hospital)\b/i
  const frHits = (lower.match(frStrong) || []).length
  const enHits = (lower.match(enStrong) || []).length
  if (frHits >= 1 && enHits === 0) return "fr"
  if (enHits >= 1 && frHits === 0) return "en"
  if (frHits >= 2) return "fr"
  if (enHits >= 2) return "en"

  const frFn = [
    ...lower.matchAll(
      /\b(je|tu|il|elle|nous|vous|ils|elles|avec|pour|dans|sur|très|bien|comme|alors|suis|sommes|êtes|sont|avez|ont|faire|fais|fait|ici|aussi|chez|sans|mais|donc|car)\b/g
    ),
  ].length
  const enFn = [
    ...lower.matchAll(
      /\b(i|we|you|they|with|from|about|very|well|like|then|when|have|has|had|get|got|make|made|this|that|here|also|without|but|because)\b/g
    ),
  ].length
  if (frFn >= 4 && frFn > enFn + 2) {
    if (biasEnglishWhenUiFrench && (enFn >= 2 || enHits >= 1)) return "en"
    return "fr"
  }
  if (enFn >= 4 && enFn > frFn + 2) {
    if (biasFrenchWhenUiEnglish && (frFn >= 2 || frHits >= 1)) return "fr"
    return "en"
  }

  if (biasFrenchWhenUiEnglish) {
    if (frFn >= 2 && frFn + 1 >= enFn) return "fr"
    if (t.length >= 12 && frFn >= 1 && enHits === 0 && enFn <= 4) return "fr"
  }

  if (biasEnglishWhenUiFrench) {
    if (enFn >= 2 && enFn + 1 >= frFn) return "en"
    if (t.length >= 12 && enFn >= 1 && frHits === 0 && frFn <= 4) return "en"
  }

  return null
}
