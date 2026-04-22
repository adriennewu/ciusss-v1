/** Best-effort MIME for broad mobile + desktop MediaRecorder support. */
const CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/aac",
] as const

export function pickMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  for (const t of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

export function extensionForRecorderMime(mime: string | undefined): string {
  if (!mime) return "webm"
  if (mime.includes("webm")) return "webm"
  if (mime.includes("mp4")) return "m4a"
  if (mime.includes("aac")) return "aac"
  return "webm"
}
