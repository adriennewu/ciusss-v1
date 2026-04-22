/**
 * True when the page is running in an iOS / iPadOS browser (all browsers use WebKit).
 * Used to prefer MediaRecorder + server transcription over Web Speech API.
 */
export function isIOSLikeClient(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true
  }
  return false
}
